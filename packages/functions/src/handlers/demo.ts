import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { docClient, PutCommand, GetCommand, DeleteCommand, ScanCommand, QueryCommand } from "../lib/dynamo.js";
import { jsonResponse, getUserIdFromEvent, Team, Schedule } from "../types/index.js";
import { randomUUID } from "crypto";

const ALARMS_TOPIC_ARN = process.env.ALARMS_TOPIC_ARN!;
const TEAMS_TABLE = process.env.TEAMS_TABLE!;
const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE!;
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE!;
const snsClient = new SNSClient({});

const DEFAULT_TEAM_ID = "fault-tec-admins";
const DEFAULT_AWS_ACCOUNT = "123456789012";

// Demo alarm configurations - simulates CloudWatch alarms
const DEMO_ALARMS = [
  { name: "CPU-Utilization-Critical", severity: "critical", delay: 0 },
  { name: "Memory-Pressure-Warning", severity: "warning", delay: 1500 },
  { name: "DiskSpace-Low-Warning", severity: "warning", delay: 3000 },
  { name: "API-Latency-Critical", severity: "critical", delay: 4500 },
  { name: "DB-Connections-Critical", severity: "critical", delay: 6000 },
  { name: "Lambda-Errors-Warning", severity: "warning", delay: 7500 },
  { name: "Network-Saturation-Info", severity: "info", delay: 9000 },
  { name: "Cache-Hit-Rate-Warning", severity: "warning", delay: 10500 },
];

// CloudWatch Alarm SNS message format
interface CloudWatchAlarmMessage {
  AlarmName: string;
  AlarmArn: string;
  NewStateValue: "ALARM" | "OK";
  NewStateReason: string;
  StateChangeTime: string;
  Region: string;
  AWSAccountId: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // POST /demo/start - Start cloud demo via SNS (e2e flow)
    if (method === "POST" && path === "/demo/start") {
      const body = JSON.parse(event.body || "{}");
      // Use provided account ID or default demo account
      const awsAccountId = body.aws_account_id || "123456789012";

      const publishedAlarms: string[] = [];

      // Publish alarms to SNS with random 1-6s delays between each
      for (let i = 0; i < DEMO_ALARMS.length; i++) {
        const alarm = DEMO_ALARMS[i];

        // Random delay 1-3 seconds before each alarm (except first)
        if (i > 0) {
          const delay = 1000 + Math.random() * 2000; // 1-3 seconds
          console.log(`[Demo] Waiting ${Math.round(delay)}ms before next alarm...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const alarmMessage: CloudWatchAlarmMessage = {
          AlarmName: alarm.name,
          AlarmArn: `arn:aws:cloudwatch:eu-west-1:${awsAccountId}:alarm:${alarm.name}`,
          NewStateValue: "ALARM",
          NewStateReason: `Demo: ${alarm.name} threshold exceeded (simulated)`,
          StateChangeTime: new Date().toISOString(),
          Region: "eu-west-1",
          AWSAccountId: awsAccountId,
        };

        await snsClient.send(
          new PublishCommand({
            TopicArn: ALARMS_TOPIC_ARN,
            Message: JSON.stringify(alarmMessage),
            Subject: `ALARM: "${alarm.name}" in EU (Ireland)`,
          })
        );

        console.log(`[Demo] Published alarm ${i + 1}/${DEMO_ALARMS.length}: ${alarm.name}`);
        publishedAlarms.push(alarm.name);
      }

      console.log(`[Demo] Published ${publishedAlarms.length} demo alarms to SNS for account ${awsAccountId}`);

      return jsonResponse(200, {
        message: "Demo alarms published to SNS",
        alarm_count: publishedAlarms.length,
        alarms: publishedAlarms,
        aws_account_id: awsAccountId,
        note: "Alarms will be processed by alarm-handler and create incidents",
      });
    }

    // POST /demo/setup - Create default team and add user as on-call
    if (method === "POST" && path === "/demo/setup") {
      const body = JSON.parse(event.body || "{}");
      const awsAccountId = body.aws_account_id || DEFAULT_AWS_ACCOUNT;

      // Check if team exists
      const existingTeam = await docClient.send(
        new GetCommand({
          TableName: TEAMS_TABLE,
          Key: { team_id: DEFAULT_TEAM_ID },
        })
      );

      let teamCreated = false;
      if (!existingTeam.Item) {
        // Create default team
        const team: Team = {
          team_id: DEFAULT_TEAM_ID,
          name: "Fault-Tec Admins",
          aws_account_ids: [awsAccountId],
          escalation_policy: {
            levels: [
              { delay_minutes: 5, target: "on_call" },
              { delay_minutes: 15, target: "all_team" },
            ],
          },
          created_at: Date.now(),
        };

        await docClient.send(
          new PutCommand({
            TableName: TEAMS_TABLE,
            Item: team,
          })
        );
        teamCreated = true;
        console.log(`[Demo] Created team: ${team.name}`);
      }

      // Create/update on-call schedule for current user (24h from now)
      const now = Date.now();
      const schedule: Schedule = {
        team_id: DEFAULT_TEAM_ID,
        slot_id: `oncall-${randomUUID()}`,
        user_id: userId,
        start: now,
        end: now + 24 * 60 * 60 * 1000, // 24 hours
      };

      await docClient.send(
        new PutCommand({
          TableName: SCHEDULES_TABLE,
          Item: schedule,
        })
      );

      console.log(`[Demo] Created on-call schedule for user ${userId}`);

      return jsonResponse(200, {
        message: "Demo setup complete",
        team_id: DEFAULT_TEAM_ID,
        team_created: teamCreated,
        aws_account_id: awsAccountId,
        on_call_until: new Date(schedule.end).toISOString(),
      });
    }

    // POST /demo/reset - Clean up all demo data
    if (method === "POST" && path === "/demo/reset") {
      let deletedIncidents = 0;
      let deletedSchedules = 0;

      // Delete all incidents for demo team
      const incidentsResult = await docClient.send(
        new ScanCommand({
          TableName: INCIDENTS_TABLE,
          FilterExpression: "team_id = :tid",
          ExpressionAttributeValues: { ":tid": DEFAULT_TEAM_ID },
          ProjectionExpression: "incident_id",
        })
      );

      if (incidentsResult.Items) {
        for (const item of incidentsResult.Items) {
          await docClient.send(
            new DeleteCommand({
              TableName: INCIDENTS_TABLE,
              Key: { incident_id: item.incident_id },
            })
          );
          deletedIncidents++;
        }
      }

      // Delete all schedules for demo team
      const schedulesResult = await docClient.send(
        new QueryCommand({
          TableName: SCHEDULES_TABLE,
          KeyConditionExpression: "team_id = :tid",
          ExpressionAttributeValues: { ":tid": DEFAULT_TEAM_ID },
          ProjectionExpression: "team_id, slot_id",
        })
      );

      if (schedulesResult.Items) {
        for (const item of schedulesResult.Items) {
          await docClient.send(
            new DeleteCommand({
              TableName: SCHEDULES_TABLE,
              Key: { team_id: item.team_id, slot_id: item.slot_id },
            })
          );
          deletedSchedules++;
        }
      }

      // Delete the demo team
      await docClient.send(
        new DeleteCommand({
          TableName: TEAMS_TABLE,
          Key: { team_id: DEFAULT_TEAM_ID },
        })
      );

      console.log(`[Demo] Reset complete: deleted ${deletedIncidents} incidents, ${deletedSchedules} schedules, 1 team`);

      return jsonResponse(200, {
        message: "Demo reset complete",
        deleted_incidents: deletedIncidents,
        deleted_schedules: deletedSchedules,
        deleted_team: DEFAULT_TEAM_ID,
      });
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
}
