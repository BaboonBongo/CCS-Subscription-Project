const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

// AWS SDK clients
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// CORS headers for API Gateway responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function isApiGatewayEvent(event) {
  return !!(event && event.requestContext && event.requestContext.http);
}

function parsePayload(event) {
  if (event && Object.prototype.hasOwnProperty.call(event, "body") && event.body) {
    if (typeof event.body === "string") {
      try {
        return JSON.parse(event.body);
      } catch (err) {
        throw new Error("Invalid JSON in event.body");
      }
    }
    return event.body;
  }

  return event || {};
}

exports.handler = async (event) => {
  console.log("=== PAYMENT LAMBDA START ===");
  console.log("Received event:", JSON.stringify(event));

  // Handle API Gateway preflight
  if (
    isApiGatewayEvent(event) &&
    event.requestContext.http.method === "OPTIONS"
  ) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    console.log(">>> Startup notification skipped for debugging");

    const payload = parsePayload(event);
    const { userId, email, tier } = payload;

    if (!userId || !email || !tier) {
      throw new Error("Missing required fields: userId, email, or tier.");
    }

    const success = Math.random() < 0.7;

    console.log("Payment attempt:", {
      userId,
      email,
      tier,
      success,
    });

    if (success) {
      console.log(">>> Entered SUCCESS branch");
      console.log(">>> About to update DynamoDB");

      try {
        await docClient.send(
          new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { userId },
            UpdateExpression:
              "SET #tier = :tier, subStatus = :status, subStart = :start",
            ExpressionAttributeNames: {
              "#tier": "tier",
            },
            ExpressionAttributeValues: {
              ":tier": tier,
              ":status": "active",
              ":start": new Date().toISOString(),
            },
          })
        );

        console.log(">>> DynamoDB update complete");
      } catch (err) {
        console.error(">>> DynamoDB update FAILED:", err);
        throw err;
      }

      const responseBody = {
        success: true,
        userId,
        email,
        tier,
      };

      if (isApiGatewayEvent(event)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(responseBody),
        };
      }

      return responseBody;
    } else {
      console.log(">>> Entered FAILURE branch");

      const responseBody = {
        success: false,
        userId,
        email,
        tier,
      };

      if (isApiGatewayEvent(event)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(responseBody),
        };
      }

      return responseBody;
    }
  } catch (err) {
    console.error("Payment error:", err);

    if (isApiGatewayEvent(event)) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: err.message,
        }),
      };
    }

    throw err;
  }
};