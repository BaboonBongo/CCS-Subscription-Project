const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sfnClient = new SFNClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

// CORS headers — required because this Lambda is called directly from the browser
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/**
 * Payment Lambda Handler
 *
 * Receives POST /subscribe from API Gateway.
 * Simulates payment with 70/30 success/failure split.
 *
 * On success:
 *   1. Updates DynamoDB (tier, subStatus="active", subStart)
 *   2. Starts Step Functions execution (5-second countdown)
 *   3. Publishes PAYMENT_SUCCESS to SNS
 *
 * On failure:
 *   1. Publishes PAYMENT_FAILED to SNS only
 */
exports.handler = async (event) => {
  // Handle CORS preflight request
  if (event.requestContext && event.requestContext.http && event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const { userId, email, tier } = JSON.parse(event.body);

    // 70/30 payment simulation
    // Math.random() returns 0-0.999...
    // < 0.7 is true ~70% of the time (success)
    // >= 0.7 is true ~30% of the time (failure)
    const success = Math.random() < 0.7;

    console.log("Payment attempt:", { userId, email, tier, success });

    if (success) {
      // --- SUCCESS PATH ---

      // 1. Update DynamoDB: set tier, subStatus="active", subStart=now
      // NOTE: "tier" is a DynamoDB reserved word — must use ExpressionAttributeNames
      await docClient.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { userId },
          UpdateExpression: "SET #tier = :tier, subStatus = :status, subStart = :start",
          ExpressionAttributeNames: { "#tier": "tier" },
          ExpressionAttributeValues: {
            ":tier": tier,
            ":status": "active",
            ":start": new Date().toISOString(),
          },
        })
      );
      console.log("DynamoDB updated: subscription active");

      // 2. Start Step Functions execution (5-second countdown to expiry)
      // The name must be unique per execution — userId + timestamp guarantees this
      await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn: process.env.STATE_MACHINE_ARN,
          name: `sub-${userId}-${Date.now()}`,
          input: JSON.stringify({ userId, email, tier }),
        })
      );
      console.log("Step Functions execution started");

      // 3. Publish PAYMENT_SUCCESS to SNS
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Message: JSON.stringify({
            type: "PAYMENT_SUCCESS",
            email,
            userId,
          }),
        })
      );
      console.log("PAYMENT_SUCCESS published to SNS");
    } else {
      // --- FAILURE PATH ---

      // Only publish PAYMENT_FAILED to SNS
      // No DynamoDB update, no Step Functions execution
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Message: JSON.stringify({
            type: "PAYMENT_FAILED",
            email,
            userId,
          }),
        })
      );
      console.log("PAYMENT_FAILED published to SNS");
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success }),
    };
  } catch (err) {
    console.error("Payment error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
