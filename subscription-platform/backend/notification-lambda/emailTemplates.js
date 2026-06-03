/**
 * Email Templates for Notification Lambda
 *
 * Three templates matching the three SNS event types:
 *   - PAYMENT_SUCCESS   -> paymentSuccess(email)
 *   - PAYMENT_FAILED    -> paymentFailed(email)
 *   - SUBSCRIPTION_EXPIRED -> subscriptionExpired(email)
 *
 * Each function returns { subject, body } for use with SES.
 */

function paymentSuccess(email) {
  return {
    subject: "Subscription Activated — Welcome!",
    body: `Hello ${email},

Your subscription has been successfully activated! 🎉

You now have full access to your tier's content library. Enjoy exploring all the exclusive content available to you.

Thank you for subscribing to our platform.

— Subscription Platform Team`,
  };
}

function paymentFailed(email) {
  return {
    subject: "Payment Failed — Action Required",
    body: `Hello ${email},

Unfortunately, your payment could not be processed at this time.

Your subscription has NOT been activated. Please try again or use a different payment method.

If you continue to experience issues, please contact our support team.

— Subscription Platform Team`,
  };
}

function subscriptionExpired(email) {
  return {
    subject: "Subscription Expired",
    body: `Hello Valued User,

Your subscription has expired. You will no longer have access to tier-locked content.

To continue enjoying premium content, please renew your subscription.

We hope to see you back soon!

— Subscription Platform Team`,
  };
}

module.exports = { paymentSuccess, paymentFailed, subscriptionExpired };
