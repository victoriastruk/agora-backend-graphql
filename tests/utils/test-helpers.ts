import { app } from "@/app";

export { app };


const BASE_URL = "http://localhost";

const makeRequest = (
  app: typeof import("@/app").app,
  method: string,
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<Response> =>
  app.handle(
    new Request(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  );

export const testUtils = {
  createAgent: () => ({
    get: (path: string, options?: RequestInit) =>
      makeRequest(app, "GET", path, undefined, options),

    post: (path: string, body?: unknown, options?: RequestInit) =>
      makeRequest(app, "POST", path, body, options),
  }),

  parseResponse: async (response: Response): Promise<unknown> => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  parseGraphQLResponse: async (response: Response) => {
    const result = (await testUtils.parseResponse(response)) as {
      data?: unknown;
      errors?: unknown[];
      extensions?: unknown;
    };
    return {
      data: result.data,
      errors: result.errors,
      extensions: result.extensions,
    };
  },

  getCookie: (response: Response, cookieName: string): string | null => {
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) return null;

    const cookie = setCookie
      .split(",")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`));

    return cookie?.split(";")[0].split("=")[1] ?? null;
  },

  generateTestUser: (overrides: Record<string, unknown> = {}) => ({
    username: `testuser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    email: `test${Date.now()}@example.com`,
    password: "TestPassword123!",
    ...overrides,
  }),

  wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),

  graphql: {
    request: async (
      document: string,
      variables?: Record<string, unknown>,
      authToken?: string,
    ): Promise<Response> =>
      app.handle(
        new Request(`${BASE_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({
            query: document,
            variables: variables ?? {},
          }),
        }),
      ),
  },

  mockRedis: () => ({
    setex: () => Promise.resolve("OK"),
    get: (): Promise<string | null> => Promise.resolve(null),
    del: () => Promise.resolve(1),
    expire: () => Promise.resolve(1),
  }),
};