import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as jwt from "jsonwebtoken";
import * as http2 from "http2";
import { Device } from "../types/index.js";

const APNS_SECRET_ARN = process.env.APNS_SECRET_ARN!;
const secretsClient = new SecretsManagerClient({});

export interface ApnsConfig {
  key: string;
  keyId: string;
  teamId: string;
  bundleId: string;
}

export interface PushNotification {
  title: string;
  body: string;
  sound?: string;
  interruptionLevel?: "passive" | "active" | "time-sensitive" | "critical";
  badge?: number;
  data?: Record<string, unknown>;
}

let cachedApnsConfig: ApnsConfig | null = null;

export async function getApnsConfig(): Promise<ApnsConfig | null> {
  if (cachedApnsConfig) return cachedApnsConfig;

  try {
    const secret = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: APNS_SECRET_ARN })
    );
    if (secret.SecretString) {
      cachedApnsConfig = JSON.parse(secret.SecretString);
      return cachedApnsConfig;
    }
  } catch (error) {
    console.error("[APNs] Failed to get config:", error);
  }
  return null;
}

function generateApnsJwt(config: ApnsConfig): string {
  return jwt.sign(
    { iss: config.teamId, iat: Math.floor(Date.now() / 1000) },
    config.key,
    { algorithm: "ES256", header: { alg: "ES256", kid: config.keyId } }
  );
}

export async function sendPushNotification(
  device: Device,
  notification: PushNotification
): Promise<{ success: boolean; error?: string }> {
  if (device.platform !== "ios") {
    console.log(`[APNs] Skipping non-iOS device: ${device.platform}`);
    return { success: false, error: "Non-iOS device" };
  }

  const config = await getApnsConfig();
  if (!config) {
    console.log("[APNs] No config, skipping push");
    return { success: false, error: "APNs not configured" };
  }

  const payload = {
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: notification.sound || "default",
      "interruption-level": notification.interruptionLevel || "active",
      badge: notification.badge ?? 0,
    },
    ...notification.data,
  };

  const jwtToken = generateApnsJwt(config);
  const apnsHost = device.sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  console.log(`[APNs] Using ${device.sandbox ? "sandbox" : "production"} endpoint`);

  return new Promise((resolve) => {
    const client = http2.connect(`https://${apnsHost}`);

    client.on("error", (err) => {
      console.error("[APNs] Connection error:", err);
      client.close();
      resolve({ success: false, error: err.message });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${device.device_token}`,
      authorization: `bearer ${jwtToken}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": notification.interruptionLevel === "critical" ? "10" : "5",
      "content-type": "application/json",
    });

    let responseData = "";

    req.on("response", (headers) => {
      const status = headers[":status"];
      if (status === 200) {
        console.log(`[APNs] Sent: ${notification.title}`);
        client.close();
        resolve({ success: true });
      } else {
        console.error(`[APNs] Failed: ${status}`);
      }
    });

    req.on("data", (chunk) => {
      responseData += chunk;
    });

    req.on("end", () => {
      if (responseData) {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ success: false, error: parsed.reason || "Unknown error" });
        } catch {
          resolve({ success: false, error: responseData });
        }
      }
      client.close();
    });

    req.on("error", (err) => {
      console.error("[APNs] Request error:", err);
      client.close();
      resolve({ success: false, error: err.message });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}
