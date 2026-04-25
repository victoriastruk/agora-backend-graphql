import { t } from "elysia";

export const registerBody = t.Object({
  username: t.String({
    minLength: 3,
    maxLength: 30,
    pattern: "^[a-zA-Z0-9_]+$",
  }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});

export const loginBody = t.Object({
  usernameOrEmail: t.String({ minLength: 3 }),
  password: t.String({ minLength: 6 }),
});