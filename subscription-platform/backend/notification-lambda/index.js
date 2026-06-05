const https = require("https");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { paymentSuccess, paymentFailed, subscriptionExpired } = require("./emailTemplates");
const {
  paymentSuccess: tgPaymentSuccess,
  paymentFailed: tgPaymentFailed,
  subscriptionExpired: tgSubscriptionExpired,
} = require("./telegramTemplates");

// ─── SES client (kept for email fallback) ───
const sesClient = new SESClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

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
 * Send an email via Amazon SES (kept as fallback / dual notification).
 *
 * @param {string} recipient - The recipient email address (must be verified in SES sandbox)
 * @param {string} subject - The email subject line
 * @param {string} body - The email body text
 */
async function sendEmail(recipient, subject, body) {
  await sesClient.send(
    new SendEmailCommand({
      Source: process.env.SENDER_EMAIL,
      Destination: {
        ToAddresses: [recipient],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: body },
        },
      },
    })
  );
}

/**
 * Notification Lambda Handler
 *
 * Triggered by SNS when paymentLambda or expirationLambda publishes a message.
 * Reads the event type from the SNS message payload and sends notifications
 * via both Telegram Bot and SES email.
 *
 * Expected SNS message format:
 *   { type: "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "SUBSCRIPTION_EXPIRED", email, userId }
 */
exports.handler = async (event) => {
  console.log("Notification Lambda invoked with", event.Records.length, "records");

  for (const record of event.Records) {
    const payload = JSON.parse(record.Sns.Message);
    console.log("Processing event:", payload.type, "for", payload.email);

    let emailTemplate;
    let telegramMessage;

    switch (payload.type) {
      case "PAYMENT_SUCCESS":
        emailTemplate = paymentSuccess(payload.email);
        telegramMessage = tgPaymentSuccess(payload.email);
        break;
      case "PAYMENT_FAILED":
        emailTemplate = paymentFailed(payload.email);
        telegramMessage = tgPaymentFailed(payload.email);
        break;
      case "SUBSCRIPTION_EXPIRED":
        emailTemplate = subscriptionExpired(payload.email);
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

    // ─── Send email via SES (secondary / fallback) ───
    if (process.env.SENDER_EMAIL) {
      try {
        await sendEmail(payload.email, emailTemplate.subject, emailTemplate.body);
        console.log("Email sent:", payload.type, payload.email);
      } catch (err) {
        console.error("Failed to send email:", payload.type, payload.email, err);
      }
    }
  }

  return { success: true };
};
