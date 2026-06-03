const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

/**
 * Expiration Lambda Handler
 *
 * IMPORTANT: This Lambda is invoked by Step Functions, NOT by API Gateway.
 * The event is the raw Step Functions input — NOT an HTTP event.
 * There is NO event.body. Do NOT call JSON.parse(event.body).
 * The input fields (userId, email, tier) are directly on the event object.
 *
 * Steps:
 *   1. Update DynamoDB: set subStatus = "expired"
 *   2. Publish SUBSCRIPTION_EXPIRED to SNS
 */
exports.handler = async (event) => {
  // event comes directly from Step Functions input — no JSON.parse needed
  const { userId, email } = event;

  console.log("Expiring subscription for userId:", userId, "email:", email);

  try {
    // Step 1: Mark subscription as expired in DynamoDB
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
        UpdateExpression: "SET subStatus = :expired",
        ExpressionAttributeValues: {
          ":expired": "expired",
        },
      })
    );
    console.log("DynamoDB updated: subStatus = expired");

    // Step 2: Publish SUBSCRIPTION_EXPIRED to SNS
    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify({
          type: "SUBSCRIPTION_EXPIRED",
          email,
          userId,
        }),
      })
    );
    console.log("SUBSCRIPTION_EXPIRED published to SNS");

    console.log("Subscription expired for userId:", userId);
    return { success: true };
  } catch (err) {
    console.error("Expiration error:", err);
    throw err;
  }
};
