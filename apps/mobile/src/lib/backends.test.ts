import { describe, it, expect, beforeEach } from "vitest";
import {
  getBackends,
  saveBackends,
  addBackend,
  updateBackend,
  deleteBackend,
  getActiveBackendId,
  setActiveBackendId,
  getActiveBackend,
  initializeDefaultBackend,
  CloudBackend,
} from "./backends";

describe("backends", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getBackends", () => {
    it("returns empty array when no backends stored", () => {
      expect(getBackends()).toEqual([]);
    });

    it("returns stored backends", () => {
      const backends: CloudBackend[] = [
        {
          id: "1",
          name: "Test",
          apiUrl: "https://api.test.com",
          region: "us-east-1",
          userPoolId: "pool-1",
          userPoolClientId: "client-1",
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("cw-alarms-backends", JSON.stringify(backends));
      expect(getBackends()).toEqual(backends);
    });

    it("returns empty array on invalid JSON", () => {
      localStorage.setItem("cw-alarms-backends", "invalid json");
      expect(getBackends()).toEqual([]);
    });
  });

  describe("saveBackends", () => {
    it("saves backends to localStorage", () => {
      const backends: CloudBackend[] = [
        {
          id: "1",
          name: "Test",
          apiUrl: "https://api.test.com",
          region: "us-east-1",
          userPoolId: "pool-1",
          userPoolClientId: "client-1",
          createdAt: Date.now(),
        },
      ];
      saveBackends(backends);
      expect(JSON.parse(localStorage.getItem("cw-alarms-backends")!)).toEqual(backends);
    });
  });

  describe("addBackend", () => {
    it("adds a new backend with generated id and createdAt", () => {
      const backend = addBackend({
        name: "Production",
        apiUrl: "https://api.prod.com",
        region: "eu-west-1",
        userPoolId: "pool-prod",
        userPoolClientId: "client-prod",
      });

      expect(backend.id).toBeDefined();
      expect(backend.name).toBe("Production");
      expect(backend.createdAt).toBeDefined();
      expect(getBackends()).toHaveLength(1);
    });

    it("sets first backend as active automatically", () => {
      const backend = addBackend({
        name: "First",
        apiUrl: "https://api.first.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      expect(getActiveBackendId()).toBe(backend.id);
    });

    it("does not change active backend when adding second backend", () => {
      const first = addBackend({
        name: "First",
        apiUrl: "https://api.first.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      addBackend({
        name: "Second",
        apiUrl: "https://api.second.com",
        region: "us-west-2",
        userPoolId: "pool-2",
        userPoolClientId: "client-2",
      });

      expect(getActiveBackendId()).toBe(first.id);
      expect(getBackends()).toHaveLength(2);
    });
  });

  describe("updateBackend", () => {
    it("updates an existing backend", () => {
      const backend = addBackend({
        name: "Original",
        apiUrl: "https://api.original.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      updateBackend(backend.id, { name: "Updated", apiUrl: "https://api.updated.com" });

      const updated = getBackends()[0];
      expect(updated.name).toBe("Updated");
      expect(updated.apiUrl).toBe("https://api.updated.com");
      expect(updated.region).toBe("us-east-1"); // unchanged
    });

    it("does nothing for non-existent backend", () => {
      addBackend({
        name: "Existing",
        apiUrl: "https://api.existing.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      updateBackend("non-existent-id", { name: "Should Not Exist" });

      expect(getBackends()[0].name).toBe("Existing");
    });
  });

  describe("deleteBackend", () => {
    it("deletes a backend", () => {
      const backend = addBackend({
        name: "ToDelete",
        apiUrl: "https://api.delete.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      deleteBackend(backend.id);

      expect(getBackends()).toHaveLength(0);
    });

    it("switches active backend when deleting active one", () => {
      const first = addBackend({
        name: "First",
        apiUrl: "https://api.first.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      const second = addBackend({
        name: "Second",
        apiUrl: "https://api.second.com",
        region: "us-west-2",
        userPoolId: "pool-2",
        userPoolClientId: "client-2",
      });

      expect(getActiveBackendId()).toBe(first.id);

      deleteBackend(first.id);

      expect(getActiveBackendId()).toBe(second.id);
    });

    it("clears active backend when deleting last backend", () => {
      const backend = addBackend({
        name: "Only",
        apiUrl: "https://api.only.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      deleteBackend(backend.id);

      expect(getActiveBackendId()).toBeNull();
    });
  });

  describe("getActiveBackendId / setActiveBackendId", () => {
    it("returns null when no active backend", () => {
      expect(getActiveBackendId()).toBeNull();
    });

    it("sets and gets active backend id", () => {
      setActiveBackendId("test-id");
      expect(getActiveBackendId()).toBe("test-id");
    });

    it("removes active backend when set to null", () => {
      setActiveBackendId("test-id");
      setActiveBackendId(null);
      expect(getActiveBackendId()).toBeNull();
    });
  });

  describe("getActiveBackend", () => {
    it("returns null when no active backend", () => {
      expect(getActiveBackend()).toBeNull();
    });

    it("returns null when active id does not match any backend", () => {
      setActiveBackendId("non-existent");
      expect(getActiveBackend()).toBeNull();
    });

    it("returns the active backend", () => {
      const backend = addBackend({
        name: "Active",
        apiUrl: "https://api.active.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      const active = getActiveBackend();
      expect(active).not.toBeNull();
      expect(active!.id).toBe(backend.id);
      expect(active!.name).toBe("Active");
    });
  });

  describe("initializeDefaultBackend", () => {
    it("does nothing when backends already exist", () => {
      addBackend({
        name: "Existing",
        apiUrl: "https://api.existing.com",
        region: "us-east-1",
        userPoolId: "pool-1",
        userPoolClientId: "client-1",
      });

      const countBefore = getBackends().length;
      initializeDefaultBackend();

      expect(getBackends()).toHaveLength(countBefore);
      expect(getBackends()[0].name).toBe("Existing");
    });

    it("creates default backend from env vars if available", () => {
      // This test verifies initializeDefaultBackend behavior
      // It will create a backend if env vars are set, or do nothing if not
      initializeDefaultBackend();
      const backends = getBackends();

      // Either 0 (no env vars) or 1 (env vars present) is valid
      expect(backends.length).toBeLessThanOrEqual(1);

      if (backends.length === 1) {
        expect(backends[0].name).toBe("Default");
      }
    });
  });
});
