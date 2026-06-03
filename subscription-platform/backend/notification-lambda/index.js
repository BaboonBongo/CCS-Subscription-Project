const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { paymentSuccess, paymentFailed, subscriptionExpired } = require("./emailTemplates");

// Initialize SES client
const sesClient = new SESClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

/**
 * Send an email via Amazon SES.
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
 * Reads the event type from the SNS message payload and sends the appropriate
 * email template via SES.
 *
 * Expected SNS message format:
 *   { type: "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "SUBSCRIPTION_EXPIRED", email, userId }
 */
exports.handler = async (event) => {
  console.log("Notification Lambda invoked with", event.Records.length, "records");

  for (const record of event.Records) {
    const payload = JSON.parse(record.Sns.Message);
    console.log("Processing event:", payload.type, "for", payload.email);

    let template;

    switch (payload.type) {
      case "PAYMENT_SUCCESS":
        template = paymentSuccess(payload.email);
        break;
      case "PAYMENT_FAILED":
        template = paymentFailed(payload.email);
        break;
      case "SUBSCRIPTION_EXPIRED":
        template = subscriptionExpired(payload.email);
        break;
      default:
        console.log("Unknown event type:", payload.type);
        continue;
    }

    try {
      await sendEmail(payload.email, template.subject, template.body);
      console.log("Email sent:", payload.type, payload.email);
    } catch (err) {
      console.error("Failed to send email:", payload.type, payload.email, err);
    }
  }

  return { success: true };
};
