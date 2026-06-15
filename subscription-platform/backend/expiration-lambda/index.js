const https = require("https");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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

    // Step 2: Send Telegram Notification for subscription expiration
    const expireMessage = `⏰ <b>Subscription Expired</b>\n\n` +
      `Hello <b>${email}</b>,\n\n` +
      `Your subscription has expired. You will no longer have access to tier-locked content.\n\n` +
      `To continue enjoying premium content, please renew your subscription.\n` +
      `We hope to see you back soon!\n\n` +
      `— <i>Subscription Platform Team</i>`;
    await sendTelegram(expireMessage);
    console.log("Telegram notification sent for subscription expiration");

    console.log("Subscription expired for userId:", userId);
    return { success: true };
  } catch (err) {
    console.error("Expiration error:", err);
    throw err;
  }
};
