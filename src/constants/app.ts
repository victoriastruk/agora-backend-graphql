export const API_VERSION = "1.0.0";
export const API_MESSAGE = "Reddit Backend API";
export const HEALTH_STATUS_OK = "ok";

export const ROUTES = {
  DOCS: "/docs",
  GRAPHQL: "/graphql",
  HEALTH: "/health",
  ROOT: "/",
} as const;

export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;
