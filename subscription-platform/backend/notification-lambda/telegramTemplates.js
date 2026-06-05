/**
 * Telegram Message Templates for Notification Lambda
 *
 * Three templates matching the three SNS event types:
 *   - PAYMENT_SUCCESS      -> paymentSuccess(email)
 *   - PAYMENT_FAILED       -> paymentFailed(email)
 *   - SUBSCRIPTION_EXPIRED -> subscriptionExpired(email)
 *
 * Each function returns a formatted string for Telegram (supports HTML parse mode).
 */

function paymentSuccess(email) {
  return (
    `✅ <b>Subscription Activated!</b>\n` +
    `\n` +
    `Hello <b>${email}</b>,\n` +
    `\n` +
    `Your subscription has been successfully activated! 🎉\n` +
    `You now have full access to your tier's content library.\n` +
    `\n` +
    `Enjoy exploring all the exclusive content available to you.\n` +
    `\n` +
    `Thank you for subscribing to our platform.\n` +
    `— <i>Subscription Platform Team</i>`
  );
}

function paymentFailed(email) {
  return (
    `❌ <b>Payment Failed</b>\n` +
    `\n` +
    `Hello <b>${email}</b>,\n` +
    `\n` +
    `Unfortunately, your payment could not be processed at this time.\n` +
    `Your subscription has <b>NOT</b> been activated.\n` +
    `\n` +
    `Please try again or use a different payment method.\n` +
    `If you continue to experience issues, please contact our support team.\n` +
    `\n` +
    `— <i>Subscription Platform Team</i>`
  );
}

function subscriptionExpired(email) {
  return (
    `⏰ <b>Subscription Expired</b>\n` +
    `\n` +
    `Hello <b>${email}</b>,\n` +
    `\n` +
    `Your subscription has expired. You will no longer have access to tier-locked content.\n` +
    `\n` +
    `To continue enjoying premium content, please renew your subscription.\n` +
    `We hope to see you back soon!\n` +
    `\n` +
    `— <i>Subscription Platform Team</i>`
  );
}

module.exports = { paymentSuccess, paymentFailed, subscriptionExpired };
