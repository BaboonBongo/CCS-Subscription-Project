const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { getAllContent, getContentById } = require("../services/contentService");
const { getUserById } = require("../services/userService");
const { generateSignedUrl } = require("../services/s3");
const tierRank = require("../utils/tierRank");

const router = express.Router();

/**
 * GET /content
 * List all content with SAFE fields only.
 * Does NOT expose s3Key or thumbnailKey to prevent URL guessing.
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const items = await getAllContent();

    // Map to safe fields only — do NOT expose s3Key or thumbnailKey
    const safeContent = items.map((item) => ({
      contentId: item.contentId,
      title: item.title,
      description: item.description,
      requiredTier: item.requiredTier,
      type: item.type,
    }));

    return res.status(200).json(safeContent);
  } catch (err) {
    console.error("List content error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /content/:id
 * Access a specific content item.
 * - Checks subscription status (must be "active")
 * - Checks tier rank (user tier >= content required tier)
 * - Returns a pre-signed S3 URL if authorized
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get content from DynamoDB
    const content = await getContentById(id);
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }

    // Get CURRENT user data from DynamoDB (not from JWT — JWT tier could be stale)
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User:", user.userId);
    console.log("Requested Content:", content.contentId);

    // Check subscription status — must be active
    if (user.subStatus !== "active") {
      return res.status(403).json({ error: "Subscription inactive" });
    }

    // Check tier rank — user tier must be >= content required tier
    if (tierRank(user.tier) < tierRank(content.requiredTier)) {
      return res.status(403).json({ error: "Tier too low" });
    }

    // Generate pre-signed URL for the media file
    const signedUrl = await generateSignedUrl(content.s3Key);

    return res.status(200).json({
      contentId: content.contentId,
      title: content.title,
      url: signedUrl,
    });
  } catch (err) {
    console.error("Access content error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
