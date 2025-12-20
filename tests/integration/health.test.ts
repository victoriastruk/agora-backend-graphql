import { describe, it, expect, beforeEach } from "bun:test";
import { createTestApp, testUtils } from "../utils/test-helpers";

describe("Health Routes Integration Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let agent: ReturnType<typeof testUtils.createAgent>;

  beforeEach(async () => {
    app = createTestApp();
    agent = testUtils.createAgent(app);
  });

  describe("GET /", () => {
    it("should return API information", async () => {
      const response = await agent.get("/");
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("version");
      expect(data).toHaveProperty("docs");
      expect(data).toHaveProperty("graphql");
      expect(data).toHaveProperty("health");

      expect(data.docs).toMatch(/\/docs/);
      expect(data.graphql).toMatch(/\/graphql/);
      expect(data.health).toMatch(/\/health/);
    });

    it("should return consistent response structure", async () => {
      const response1 = await agent.get("/");
      const data1 = await testUtils.parseResponse(response1);

      await testUtils.wait(10);

      const response2 = await agent.get("/");
      const data2 = await testUtils.parseResponse(response2);

      expect(Object.keys(data1)).toEqual(Object.keys(data2));
      expect(data1.message).toBe(data2.message);
      expect(data1.version).toBe(data2.version);
    });

    it("should have all required fields", async () => {
      const response = await agent.get("/");
      const data = await testUtils.parseResponse(response);

      expect(data.message).toBeDefined();
      expect(data.version).toBeDefined();
      expect(typeof data.message).toBe("string");
      expect(typeof data.version).toBe("string");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await agent.get("/health");
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });

    it("should return valid ISO timestamp", async () => {
      const response = await agent.get("/health");
      const data = await testUtils.parseResponse(response);

      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it("should return fresh timestamp on each request", async () => {
      const response1 = await agent.get("/health");
      const data1 = await testUtils.parseResponse(response1);

      await testUtils.wait(10);

      const response2 = await agent.get("/health");
      const data2 = await testUtils.parseResponse(response2);

      expect(data1.timestamp).not.toBe(data2.timestamp);

      const date1 = new Date(data1.timestamp);
      const date2 = new Date(data2.timestamp);
      expect(date1.getTime()).toBeLessThanOrEqual(date2.getTime());
    });

    it("should return ok status consistently", async () => {
      for (let i = 0; i < 5; i++) {
        const response = await agent.get("/health");
        const data = await testUtils.parseResponse(response);

        expect(response.status).toBe(200);
        expect(data.status).toBe("ok");
        expect(data.timestamp).toBeDefined();
      }
    });
  });

  describe("Route availability", () => {
    it("should handle non-existent routes", async () => {
      const response = await agent.get("/non-existent-route");
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(404);
    });

    it("should handle different HTTP methods on health routes", async () => {
      const postResponse = await agent.post("/health", {});
      expect(postResponse.status).toBe(405);

      const putResponse = await agent.put("/", {});
      expect(putResponse.status).toBe(405);
    });

    it("should handle DELETE method on root route", async () => {
      const response = await agent.delete("/");
      expect(response.status).toBe(405);
    });
  });
});
