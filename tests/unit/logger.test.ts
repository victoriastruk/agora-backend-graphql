import { describe, it, expect, beforeEach } from "bun:test";
import { Logger } from "@/utils/logger";

describe("Logger", () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger();
  });

  describe("Logger instantiation", () => {
    it("should create a logger instance", () => {
      expect(testLogger).toBeDefined();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it("should create a logger with module name", () => {
      const moduleLogger = new Logger("test-module");
      expect(moduleLogger).toBeDefined();
      expect(moduleLogger).toBeInstanceOf(Logger);
    });
  });

  describe("Child logger creation", () => {
    it("should create a child logger with bindings", () => {
      const childLogger = testLogger.child({ module: "test" });
      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe("Request context tracking", () => {
    it("should start a request context and run function", () => {
      const context = {
        requestId: "req-123",
        method: "GET",
        url: "/test",
        userId: "user-456",
        ip: "127.0.0.1",
      };

      const mockFn = () => "result";
      const { run } = testLogger.startRequest(context);

      const result = run(mockFn);

      expect(result).toBe("result");
    });
  });

  describe("Logging methods", () => {
    it("should log info messages", () => {
      expect(() => testLogger.info("Test info message")).not.toThrow();
    });

    it("should log info messages with data", () => {
      const data = { key: "value" };
      expect(() => testLogger.info("Test info message", data)).not.toThrow();
    });

    it("should log warn messages", () => {
      expect(() => testLogger.warn("Test warn message")).not.toThrow();
    });

    it("should log error messages", () => {
      expect(() => testLogger.error("Test error message")).not.toThrow();
    });

    it("should log error messages with Error object", () => {
      const error = new Error("Test error");
      expect(() => testLogger.error("Test error message", error)).not.toThrow();
    });

    it("should log debug messages", () => {
      expect(() => testLogger.debug("Test debug message")).not.toThrow();
    });
  });

  describe("Performance monitoring", () => {
    it("should measure execution time", async () => {
      const endTimer = testLogger.time("test operation");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => endTimer()).not.toThrow();
    });
  });

  describe("HTTP request logging", () => {
    it("should log successful requests", () => {
      const req = {
        method: "GET",
        url: "/test",
        headers: { "user-agent": "test-agent" },
        ip: "127.0.0.1",
      };
      const res = { statusCode: 200 };

      expect(() => testLogger.logRequest(req, res, 150)).not.toThrow();
    });

    it("should log error requests", () => {
      const req = {
        method: "POST",
        url: "/test",
        headers: {},
      };
      const res = { statusCode: 500 };

      expect(() => testLogger.logRequest(req, res)).not.toThrow();
    });
  });

  describe("Database operation logging", () => {
    it("should log successful database operations", () => {
      expect(() => testLogger.logDatabase("SELECT", "users", 25)).not.toThrow();
    });

    it("should log failed database operations", () => {
      const error = new Error("Connection failed");
      expect(() => testLogger.logDatabase("INSERT", "users", 100, error)).not.toThrow();
    });
  });

  describe("Application lifecycle logging", () => {
    it("should log server start", () => {
      expect(() => testLogger.logServerStart(3000, "localhost")).not.toThrow();
    });

    it("should log server shutdown", () => {
      expect(() => testLogger.logServerShutdown()).not.toThrow();
    });
  });
});
