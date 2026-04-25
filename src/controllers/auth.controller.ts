import { Elysia } from "elysia";
import { AuthUtils } from "@/utils/auth";
import type { CookieStore } from "@/types/auth";
import { AuthQueries } from "@/db/queries/auth";
import { ResponseUtils } from "@/utils/ResponseUtils";
import { registerBody, loginBody } from "./auth.schemas";
import type { User } from "@/db/schema";

const formatUser = ({ passwordHash: _, ...user }: User) => ({
  ...user,
  createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
});

export const authController = new Elysia({ prefix: "/auth" })

  .post(
    "/register",
    async ({ body, set, cookie }) => {
      const { username, email, password } = body;

      const userExists =
        (await AuthQueries.findUserByUsernameOrEmail(username)) ||
        (await AuthQueries.findUserByUsernameOrEmail(email));

      if (userExists) {
        set.status = 409;
        return ResponseUtils.error("User already exists", 409);
      }

      const passwordHash = await AuthUtils.hashPassword(password);
      const newUser = await AuthQueries.createUser({ username, email, passwordHash });

      const session = await AuthUtils.createAuthSession(newUser);
      AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);

      set.status = 201;
      return ResponseUtils.success("User registered successfully", {
        user: formatUser(newUser),
      });
    },
    { body: registerBody },
  )

  .post(
    "/login",
    async ({ body, set, cookie }) => {
      const { usernameOrEmail, password } = body;

      const user = await AuthQueries.findUserByUsernameOrEmail(usernameOrEmail);

      if (!user || !(await AuthUtils.verifyPassword(user.passwordHash, password))) {
        set.status = 401;
        return ResponseUtils.error("Invalid credentials", 401);
      }

      const session = await AuthUtils.createAuthSession(user);
      AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);

      set.status = 200;
      return ResponseUtils.success("Login successful", {
        user: formatUser(user),
      });
    },
    { body: loginBody },
  )

  .post("/logout", async ({ cookie, set }) => {
    const refreshToken = cookie.refreshToken?.value;

    if (typeof refreshToken === "string") {
      await AuthUtils.revokeRefreshTokenByToken(refreshToken);
    }

    AuthUtils.clearAuthCookies(cookie as CookieStore);

    set.status = 200;
    return ResponseUtils.success("Logout successful");
  })

  .get("/me", async ({ cookie, set }) => {
    const accessToken = cookie.accessToken?.value;
    const refreshToken = cookie.refreshToken?.value;

    const accessVerification = await AuthUtils.verifyAccessToken(
      typeof accessToken === "string" ? accessToken : undefined,
    );

    let userId: number | null = null;
    let refreshTokenIdToRevoke: string | undefined;

    if (accessVerification.status === "valid" && accessVerification.payload) {
      userId = Number(accessVerification.payload.sub);
    } else if (
      accessVerification.status === "expired" &&
      typeof refreshToken === "string"
    ) {
      const refreshVerification = await AuthUtils.verifyRefreshToken(refreshToken);

      if (refreshVerification.status === "valid" && refreshVerification.payload) {
        const isActive = await AuthUtils.isRefreshTokenActive(refreshVerification.payload.jti);

        if (!isActive) {
          AuthUtils.clearAuthCookies(cookie as CookieStore);
          set.status = 401;
          return ResponseUtils.error("Session expired", 401);
        }

        userId = Number(refreshVerification.payload.sub);
        refreshTokenIdToRevoke = refreshVerification.payload.jti;
      } else {
        AuthUtils.clearAuthCookies(cookie as CookieStore);
        set.status = 401;
        return ResponseUtils.error("Session expired", 401);
      }
    } else {
      AuthUtils.clearAuthCookies(cookie as CookieStore);
      set.status = 401;
      return ResponseUtils.error("Not authenticated", 401);
    }

    const user = userId ? await AuthQueries.findUserById(userId) : null;

    if (!user) {
      AuthUtils.clearAuthCookies(cookie as CookieStore);
      set.status = 401;
      return ResponseUtils.error("User not found", 401);
    }

    if (refreshTokenIdToRevoke) {
      const session = await AuthUtils.createAuthSession(user, {
        previousRefreshTokenId: refreshTokenIdToRevoke,
      });
      AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);
    }

    return ResponseUtils.success("User authenticated", {
      user: formatUser(user),
    });
  });