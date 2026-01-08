import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { docClient, DeleteCommand, QueryCommand } from "../lib/dynamo.js";
import { jsonResponse, getUserIdFromEvent, Device } from "../types/index.js";

const USERS_TABLE = process.env.USERS_TABLE!;
const DEVICES_TABLE = process.env.DEVICES_TABLE!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

const cognitoClient = new CognitoIdentityProviderClient({});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // DELETE /users/me - Delete current user's account
    if (method === "DELETE" && path === "/users/me") {
      console.log(`[Users] Deleting account for user: ${userId}`);

      // 1. Delete all user's devices
      const devicesResult = await docClient.send(
        new QueryCommand({
          TableName: DEVICES_TABLE,
          KeyConditionExpression: "user_id = :uid",
          ExpressionAttributeValues: { ":uid": userId },
        })
      );

      if (devicesResult.Items && devicesResult.Items.length > 0) {
        console.log(`[Users] Deleting ${devicesResult.Items.length} devices`);
        for (const device of devicesResult.Items as Device[]) {
          await docClient.send(
            new DeleteCommand({
              TableName: DEVICES_TABLE,
              Key: { user_id: userId, device_token: device.device_token },
            })
          );
        }
      }

      // 2. Delete user from users table
      console.log(`[Users] Deleting user record from DynamoDB`);
      await docClient.send(
        new DeleteCommand({
          TableName: USERS_TABLE,
          Key: { user_id: userId },
        })
      );

      // 3. Delete Cognito user
      console.log(`[Users] Deleting Cognito user`);
      await cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
        })
      );

      console.log(`[Users] Account deleted successfully`);
      return jsonResponse(200, { message: "Account deleted successfully" });
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    console.error("[Users] Error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
}
