const https = require("https");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sfnClient = new SFNClient({ region: process.env.AWS_REGION || "us-east-1" });

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram credentials not configured. Skipping notification.");
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "HTML",
    });

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed);
          } else {
            console.error("Telegram API error:", parsed.description);
            resolve();
          }
        } catch (e) {
          console.error("Failed to parse Telegram response:", data);
          resolve();
        }
      });
    });

    req.on("error", (err) => {
      console.error("Telegram request error:", err);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

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
    console.log("=== PAYMENT LAMBDA VERSION B TELEGRAM ===");
    await sendTelegram("🚨 paymentLambda invoked");


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

      // 3. Send Telegram Notification
      const successMessage = `✅ <b>Subscription Activated!</b>\n\n` +
        `Hello <b>${email}</b>,\n\n` +
        `<b>Transaction Status:</b> true\n\n` +
        `Your subscription has been successfully activated! 🎉\n` +
        `You now have full access to your tier's content library.\n\n` +
        `Thank you for subscribing to our platform.\n` +
        `— <i>Subscription Platform Team</i>`;
      await sendTelegram(successMessage);
      console.log("Telegram notification sent for success path");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } else {
      // --- FAILURE PATH ---

      // Send Telegram Notification
      const failureMessage = `❌ <b>Payment Failed</b>\n\n` +
        `Hello <b>${email}</b>,\n\n` +
        `<b>Transaction Status:</b> false\n\n` +
        `Unfortunately, your payment could not be processed at this time.\n` +
        `Your subscription has <b>NOT</b> been activated.\n\n` +
        `Please try again or use a different payment method.\n` +
        `— <i>Subscription Platform Team</i>`;
      await sendTelegram(failureMessage);
      console.log("Telegram notification sent for failure path");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: false }),
      };
    }
  } catch (err) {
    console.error("Payment error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
