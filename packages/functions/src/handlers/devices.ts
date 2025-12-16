import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { docClient, PutCommand, DeleteCommand, QueryCommand } from "../lib/dynamo.js";
import { jsonResponse, getUserIdFromEvent, Device } from "../types/index.js";
import { sendPushNotification } from "../lib/apns.js";

const DEVICES_TABLE = process.env.DEVICES_TABLE!;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // POST /devices - Register device
    if (method === "POST" && path === "/devices") {
      const body = JSON.parse(event.body || "{}");
      const { token, platform, sandbox } = body;

      if (!token || !platform) {
        return jsonResponse(400, { error: "Missing token or platform" });
      }

      if (!["ios", "android", "web"].includes(platform)) {
        return jsonResponse(400, { error: "Invalid platform" });
      }

      const device: Device = {
        user_id: userId,
        device_token: token,
        platform,
        sandbox: sandbox === true, // true for development/USB builds
        created_at: Date.now(),
      };

      await docClient.send(
        new PutCommand({
          TableName: DEVICES_TABLE,
          Item: device,
        })
      );

      return jsonResponse(201, { message: "Device registered", device });
    }

    // DELETE /devices/{token} - Unregister device
    if (method === "DELETE" && path.startsWith("/devices/")) {
      const token = event.pathParameters?.token;
      if (!token) {
        return jsonResponse(400, { error: "Missing token" });
      }

      await docClient.send(
        new DeleteCommand({
          TableName: DEVICES_TABLE,
          Key: {
            user_id: userId,
            device_token: decodeURIComponent(token),
          },
        })
      );

      return jsonResponse(200, { message: "Device unregistered" });
    }

    // POST /devices/test-push - Send test push notification
    if (method === "POST" && path === "/devices/test-push") {
      const body = JSON.parse(event.body || "{}");
      const { token } = body;

      if (!token) {
        return jsonResponse(400, { error: "Missing token" });
      }

      // Verify the device belongs to this user
      const result = await docClient.send(
        new QueryCommand({
          TableName: DEVICES_TABLE,
          KeyConditionExpression: "user_id = :uid AND device_token = :token",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":token": token,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return jsonResponse(404, { error: "Device not found" });
      }

      const device = result.Items[0] as Device;

      const pushResult = await sendPushNotification(device, {
        title: "🔔 Pip-Alert Test",
        body: "Push notifications are working!",
        sound: "default",
        interruptionLevel: "active",
      });

      if (pushResult.success) {
        return jsonResponse(200, { message: "Test notification sent" });
      } else {
        return jsonResponse(500, { error: pushResult.error || "Failed to send notification" });
      }
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
}
