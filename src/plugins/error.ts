import { Elysia } from "elysia";

/**
 * Global error handling plugin
 * Catches and formats errors consistently across the application
 */
export const errorPlugin = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    // Log error for debugging (skip in test environment)
    if (process.env.NODE_ENV !== "test") {
      console.error("Error occurred:", {
        code,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Handle different error types
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          success: false,
          error: "Validation Error",
          details: error instanceof Error ? error.message : "Validation failed",
        };

      case "NOT_FOUND":
        set.status = 404;
        return {
          success: false,
          error: "Not Found",
          message: "The requested resource was not found",
        };

      case "INTERNAL_SERVER_ERROR":
        set.status = 500;
        return {
          success: false,
          error: "Internal Server Error",
          message: "Something went wrong on our end",
        };

      default:
        set.status = 500;
        // Check if it's a database connection error
        const errorMessage =
          error instanceof Error ? error.message : "An unexpected error occurred";
        const isDbError =
          errorMessage.includes("CONNECTION_ENDED") ||
          errorMessage.includes("Failed query") ||
          errorMessage.includes("ECONNREFUSED");

        // Preserve user-friendly error messages
        const userFriendlyMessages = [
          "User not found",
          "Username already exists",
          "Email already exists",
          "Invalid user ID",
          "Password is required",
        ];

        const isUserFriendly = userFriendlyMessages.some((msg) => errorMessage.includes(msg));

        return {
          success: false,
          error: "Unknown Error",
          message: isUserFriendly
            ? errorMessage
            : isDbError
              ? "Database connection failed"
              : errorMessage,
        };
    }
  });
