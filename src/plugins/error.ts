import { Elysia } from "elysia";
import { logger } from "@/utils/logger";

type ErrorResponse = {
  success: false;
  code: string;
  message: string;
};

export const errorPlugin = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";

    logger.error("Request error", {
      code,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          success: false,
          code: "VALIDATION_ERROR",
          message,
        } satisfies ErrorResponse;

      case "NOT_FOUND":
        set.status = 404;
        return {
          success: false,
          code: "NOT_FOUND",
          message: "The requested resource was not found",
        } satisfies ErrorResponse;

      default:
        set.status = 500;

        const isDbError =
          message.includes("CONNECTION_ENDED") ||
          message.includes("Failed query") ||
          message.includes("ECONNREFUSED");

        return {
          success: false,
          code: "INTERNAL_ERROR",
          message: isDbError ? "Database connection failed" : "Something went wrong",
        } satisfies ErrorResponse;
    }
  });