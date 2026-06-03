const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { getUserById } = require("../services/userService");

const router = express.Router();

/**
 * GET /user/status
 * Returns the user's current tier, subscription status, and email.
 * Protected by verifyToken middleware.
 * Always reads from DynamoDB to get the latest status (not from JWT).
 */
router.get("/status", verifyToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      tier: user.tier,
      status: user.subStatus,
      email: user.email,
    });
  } catch (err) {
    console.error("Get status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
