import { yoga } from "@elysiajs/graphql-yoga";
import { parse } from "cookie-es";
import { schema } from "@/graphql/schema";
import { pubsub } from "@/graphql/pubsub";
import { AuthUtils } from "@/utils/auth";

const extractUserId = async (token: string): Promise<number | undefined> => {
  const verification = await AuthUtils.verifyAccessToken(token);
  if (verification.status === "valid" && verification.payload) {
    return Number(verification.payload.sub);
  }
  return undefined;
};

export const yogaPlugin = yoga({
  schema,
  graphiql: {
    title: "Agora Backend GraphQL API",
  },
  context: async ({ request }) => {
    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie");

    const token =
      authHeader?.replace("Bearer ", "") ??
      (cookieHeader ? parse(cookieHeader).accessToken : undefined);

    const userId = token ? await extractUserId(token) : undefined;

    return { userId, pubsub };
  },
});