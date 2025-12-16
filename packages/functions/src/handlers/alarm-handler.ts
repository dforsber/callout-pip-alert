import type { SNSEvent } from "aws-lambda";
import { docClient, PutCommand, QueryCommand, ScanCommand } from "../lib/dynamo.js";
import { Incident, Team, Schedule, TimelineEntry } from "../types/index.js";
import { randomUUID } from "crypto";

const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE!;
const TEAMS_TABLE = process.env.TEAMS_TABLE!;
const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE!;

interface CloudWatchAlarmMessage {
  AlarmName: string;
  AlarmArn: string;
  NewStateValue: "ALARM" | "OK" | "INSUFFICIENT_DATA";
  NewStateReason: string;
  StateChangeTime: string;
  Region: string;
  AWSAccountId: string;
}

export async function handler(event: SNSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message) as CloudWatchAlarmMessage;

      // Only process ALARM state
      if (message.NewStateValue !== "ALARM") {
        console.log(`Ignoring alarm state: ${message.NewStateValue}`);
        continue;
      }

      console.log(`Processing alarm: ${message.AlarmName} from account ${message.AWSAccountId}`);

      // Find team by AWS account ID
      const team = await findTeamByAwsAccount(message.AWSAccountId);
      if (!team) {
        console.error(`No team found for AWS account: ${message.AWSAccountId}`);
        continue;
      }

      // Find on-call user
      const onCallUserId = await findOnCallUser(team.team_id);
      if (!onCallUserId) {
        console.error(`No on-call user for team: ${team.team_id}`);
        continue;
      }

      // Create incident with 24h TTL
      const now = Date.now();
      const ttlSeconds = Math.floor(now / 1000) + 24 * 60 * 60;
      const incident: Incident = {
        incident_id: randomUUID(),
        team_id: team.team_id,
        alarm_arn: message.AlarmArn,
        alarm_name: message.AlarmName,
        state: "triggered",
        severity: determineSeverity(message.AlarmName),
        assigned_to: onCallUserId,
        escalation_level: 0,
        triggered_at: now,
        ttl: ttlSeconds,
        timeline: [
          {
            timestamp: now,
            event: "triggered",
            actor: "CloudWatch",
            note: message.NewStateReason,
          },
        ],
      };

      await docClient.send(
        new PutCommand({
          TableName: INCIDENTS_TABLE,
          Item: incident,
        })
      );

      console.log(`Created incident: ${incident.incident_id} (push handled by streams)`);

      // Push notifications are handled by DynamoDB Streams Lambda
    } catch (error) {
      console.error("Error processing alarm:", error);
    }
  }
}

async function findTeamByAwsAccount(accountId: string): Promise<Team | null> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: "contains(aws_account_ids, :accountId)",
      ExpressionAttributeValues: { ":accountId": accountId },
    })
  );
  return (result.Items?.[0] as Team) || null;
}

async function findOnCallUser(teamId: string): Promise<string | null> {
  const now = Date.now();
  const result = await docClient.send(
    new QueryCommand({
      TableName: SCHEDULES_TABLE,
      KeyConditionExpression: "team_id = :tid",
      FilterExpression: "#start <= :now AND #end > :now",
      ExpressionAttributeNames: {
        "#start": "start",
        "#end": "end",
      },
      ExpressionAttributeValues: {
        ":tid": teamId,
        ":now": now,
      },
    })
  );
  const slot = result.Items?.[0] as Schedule | undefined;
  return slot?.user_id || null;
}

function determineSeverity(alarmName: string): "critical" | "warning" | "info" {
  const lowerName = alarmName.toLowerCase();
  if (lowerName.includes("critical") || lowerName.includes("error")) {
    return "critical";
  }
  if (lowerName.includes("warning") || lowerName.includes("warn")) {
    return "warning";
  }
  return "info";
}
