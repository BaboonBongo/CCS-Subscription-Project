const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// AWS SDK clients
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function isApiGatewayEvent(event) {
  return !!(event && event.requestContext && event.requestContext.http);
}

function parsePayload(event) {
  if (
    event &&
    Object.prototype.hasOwnProperty.call(event, "body") &&
    event.body
  ) {
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

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("Telegram configuration missing.");
    return;
  }

  try {
    console.log("=== TELEGRAM START ===");

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }
    );

    const data = await response.json();

    console.log(
      "Telegram response:",
      JSON.stringify(data)
    );

    console.log("=== TELEGRAM END ===");

    if (!data.ok) {
      throw new Error(
        `Telegram API error: ${JSON.stringify(data)}`
      );
    }
  } catch (err) {
    console.error(
      "Telegram send failed:",
      err
    );
  }
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
    const payload = parsePayload(event);

    const { userId, email, tier } = payload;

    if (!userId || !email || !tier) {
      throw new Error(
        "Missing required fields: userId, email, or tier."
      );
    }

    const success = Math.random() < 0.7;

    console.log("Payment attempt:", {
      userId,
      email,
      tier,
      success,
    });

    if (success) {
      console.log(">>> SUCCESS BRANCH");

      await docClient.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: {
            userId,
          },
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

      console.log(
        "DynamoDB update successful"
      );

      // Telegram Success Notification
      await sendTelegramMessage(
        `✅ Subscription Activated

User ID: ${userId}
Email: ${email}
Tier: ${tier}
Status: Active`
      );

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
    }

    console.log(">>> FAILURE BRANCH");

    // Telegram Failure Notification
    await sendTelegramMessage(
      `❌ Payment Failed

User ID: ${userId}
Email: ${email}
Tier: ${tier}`
    );

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
  } catch (err) {
    console.error("Payment error:", err);

    try {
      await sendTelegramMessage(
        `🚨 Payment Lambda Error

${err.message}`
      );
    } catch (telegramErr) {
      console.error(
        "Failed to send error notification:",
        telegramErr
      );
    }

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