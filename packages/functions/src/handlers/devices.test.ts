import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Use vi.hoisted to define mocks that can be referenced in vi.mock
const { mockSend, mockSendPushNotification } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSendPushNotification: vi.fn(),
}));

// Mock the dynamo module
vi.mock("../lib/dynamo.js", () => ({
  docClient: { send: mockSend },
  PutCommand: vi.fn().mockImplementation((params) => ({ type: "Put", params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: "Delete", params })),
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: "Query", params })),
}));

// Mock the apns module
vi.mock("../lib/apns.js", () => ({
  sendPushNotification: mockSendPushNotification,
}));

// Set environment variables
process.env.DEVICES_TABLE = "test-devices-table";
process.env.APNS_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

// Import handler after mocks are set up
import { handler } from "./devices.js";

// Helper to create a mock event
function createMockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/devices",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api123",
      domainName: "api.example.com",
      domainPrefix: "api",
      http: {
        method: "GET",
        path: "/devices",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req123",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
      authorizer: {
        jwt: {
          claims: {
            sub: "user-123",
          },
        },
      },
    },
    isBase64Encoded: false,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

describe("devices handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no user ID in JWT claims", async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: undefined,
        },
      } as Partial<APIGatewayProxyEventV2>);

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body as string)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("POST /devices - Register device", () => {
    it("successfully registers a device", async () => {
      mockSend.mockResolvedValueOnce({});

      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({
          token: "device-token-123",
          platform: "ios",
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body as string);
      expect(body.message).toBe("Device registered");
      expect(body.device).toMatchObject({
        user_id: "user-123",
        device_token: "device-token-123",
        platform: "ios",
      });
      expect(body.device.created_at).toBeDefined();

      // Verify DynamoDB was called
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("returns 400 when token is missing", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({
          platform: "ios",
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Missing token or platform",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns 400 when platform is missing", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({
          token: "device-token-123",
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Missing token or platform",
      });
    });

    it("returns 400 when platform is invalid", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({
          token: "device-token-123",
          platform: "windows",
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Invalid platform",
      });
    });

    it("accepts all valid platforms", async () => {
      const platforms = ["ios", "android", "web"];

      for (const platform of platforms) {
        mockSend.mockResolvedValueOnce({});

        const event = createMockEvent({
          rawPath: "/devices",
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: "POST",
            },
          },
          body: JSON.stringify({
            token: `token-${platform}`,
            platform,
          }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body as string);
        expect(body.device.platform).toBe(platform);
      }
    });

    it("handles empty body gracefully", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: "",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Missing token or platform",
      });
    });
  });

  describe("DELETE /devices/{token} - Unregister device", () => {
    it("successfully unregisters a device", async () => {
      mockSend.mockResolvedValueOnce({});

      const event = createMockEvent({
        rawPath: "/devices/device-token-123",
        pathParameters: { token: "device-token-123" },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "DELETE",
          },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body as string)).toEqual({
        message: "Device unregistered",
      });

      // Verify DynamoDB delete was called
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("returns 400 when token path parameter is missing", async () => {
      const event = createMockEvent({
        rawPath: "/devices/",
        pathParameters: {},
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "DELETE",
          },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Missing token",
      });
    });

    it("decodes URL-encoded tokens", async () => {
      mockSend.mockResolvedValueOnce({});

      const encodedToken = "token%20with%20spaces";
      const event = createMockEvent({
        rawPath: `/devices/${encodedToken}`,
        pathParameters: { token: encodedToken },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "DELETE",
          },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /devices/test-push - Send test push notification", () => {
    it("successfully sends a test push notification", async () => {
      const mockDevice = {
        user_id: "user-123",
        device_token: "device-token-123",
        platform: "ios",
        created_at: 1704067200000,
      };

      mockSend.mockResolvedValueOnce({ Items: [mockDevice] });
      mockSendPushNotification.mockResolvedValueOnce({ success: true });

      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({ token: "device-token-123" }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body as string)).toEqual({
        message: "Test notification sent",
      });

      // Verify device was looked up
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify push was sent
      expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        mockDevice,
        expect.objectContaining({
          title: "🔔 Pip-Alert Test",
          body: "Push notifications are working!",
          sound: "default",
          interruptionLevel: "active",
        })
      );
    });

    it("returns 400 when token is missing", async () => {
      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Missing token",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns 404 when device not found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({ token: "unknown-token" }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Device not found",
      });
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("returns 404 when device belongs to different user", async () => {
      // Query returns no items because the key condition includes user_id
      mockSend.mockResolvedValueOnce({ Items: [] });

      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({ token: "other-users-token" }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });

    it("returns 500 when push notification fails", async () => {
      const mockDevice = {
        user_id: "user-123",
        device_token: "device-token-123",
        platform: "ios",
        created_at: 1704067200000,
      };

      mockSend.mockResolvedValueOnce({ Items: [mockDevice] });
      mockSendPushNotification.mockResolvedValueOnce({
        success: false,
        error: "APNs connection failed",
      });

      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({ token: "device-token-123" }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "APNs connection failed",
      });
    });

    it("returns generic error when push fails without specific error", async () => {
      const mockDevice = {
        user_id: "user-123",
        device_token: "device-token-123",
        platform: "ios",
        created_at: 1704067200000,
      };

      mockSend.mockResolvedValueOnce({ Items: [mockDevice] });
      mockSendPushNotification.mockResolvedValueOnce({ success: false });

      const event = createMockEvent({
        rawPath: "/devices/test-push",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({ token: "device-token-123" }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Failed to send notification",
      });
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const event = createMockEvent({
        rawPath: "/unknown",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "GET",
          },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Not found",
      });
    });

    it("returns 404 for wrong method on /devices", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "GET",
          },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe("error handling", () => {
    it("returns 500 when DynamoDB throws an error", async () => {
      mockSend.mockRejectedValueOnce(new Error("DynamoDB connection error"));

      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: JSON.stringify({
          token: "device-token-123",
          platform: "ios",
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Internal server error",
      });
    });

    it("handles malformed JSON body", async () => {
      const event = createMockEvent({
        rawPath: "/devices",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
          },
        },
        body: "not valid json",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body as string)).toEqual({
        error: "Internal server error",
      });
    });
  });
});
