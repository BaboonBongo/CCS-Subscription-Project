const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { getUserByEmail, createUser } = require("../services/userService");

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user account.
 * - Validates email and password are present
 * - Checks for existing user (409 if duplicate)
 * - Hashes password with bcrypt (10 salt rounds)
 * - Creates user in DynamoDB with tier="free", subStatus="none"
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Hash password — never store plain text
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user object
    const userId = uuidv4();
    const user = {
      userId,
      email,
      passwordHash,
      tier: "free",
      subStatus: "none",
      subStart: null,
      subExpire: null,
      createdAt: new Date().toISOString(),
    };

    await createUser(user);

    console.log("User registered:", userId, email);
    return res.status(201).json({ success: true, userId });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return a JWT.
 * - Looks up user by email (uses GSI, not Scan)
 * - Verifies password with bcrypt.compare
 * - Returns signed JWT with 24h expiry
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.userId, email: user.email, tier: user.tier },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("User logged in:", user.userId, email);
    return res.status(200).json({
      success: true,
      token,
      user: {
        userId: user.userId,
        email: user.email,
        tier: user.tier,
        subStatus: user.subStatus,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
