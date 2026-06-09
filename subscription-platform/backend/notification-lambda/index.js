const https = require("https");
const {
  paymentSuccess: tgPaymentSuccess,
  paymentFailed: tgPaymentFailed,
  subscriptionExpired: tgSubscriptionExpired,
} = require("./telegramTemplates");

// ─── Telegram Bot config ───
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send a message via Telegram Bot API using Node.js built-in https module.
 * No external dependencies needed.
 *
 * @param {string} text - The message text (HTML formatted)
 * @returns {Promise<object>} Telegram API response
 */
function sendTelegram(text) {
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
            reject(new Error(`Telegram API error: ${parsed.description}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Telegram response: ${data}`));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Notification Lambda Handler
 *
 * Triggered by SNS when paymentLambda or expirationLambda publishes a message.
 * Reads the event type from the SNS message payload and sends notifications
 * via Telegram Bot.
 *
 * Expected SNS message format:
 *   { type: "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "SUBSCRIPTION_EXPIRED", email, userId }
 */
exports.handler = async (event) => {
  console.log("Notification Lambda invoked with", event.Records.length, "records");

  for (const record of event.Records) {
    const payload = JSON.parse(record.Sns.Message);
    console.log("Processing event:", payload.type, "for", payload.email);

    let telegramMessage;

    switch (payload.type) {
      case "PAYMENT_SUCCESS":
        telegramMessage = tgPaymentSuccess(payload.email);
        break;
      case "PAYMENT_FAILED":
        telegramMessage = tgPaymentFailed(payload.email);
        break;
      case "SUBSCRIPTION_EXPIRED":
        telegramMessage = tgSubscriptionExpired(payload.email);
        break;
      default:
        console.log("Unknown event type:", payload.type);
        continue;
    }

    // ─── Send Telegram notification (primary) ───
    try {
      await sendTelegram(telegramMessage);
      console.log("Telegram sent:", payload.type, payload.email);
    } catch (err) {
      console.error("Failed to send Telegram:", payload.type, payload.email, err);
    }
  }

  return { success: true };
};
