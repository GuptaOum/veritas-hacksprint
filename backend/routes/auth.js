const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const router = express.Router();

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again later." },
});

// Login route
router.post(
  "/login",
  loginLimiter,
  [
    body("universityEmail").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { universityEmail, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ universityEmail });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if account is active
      if (user.status !== "active") {
        return res.status(403).json({ error: "Your account is inactive or suspended" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT tokens
      const token = jwt.sign(
        {
          id: user._id,
          name: user.name,
          role: user.role,
          universityEmail: user.universityEmail,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
      );

      // Log login attempt
      console.log(`User ${universityEmail} logged in at ${new Date().toISOString()}`);

      // Respond with token and user info
      res.status(200).json({
        message: "Login successful",
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          universityEmail: user.universityEmail,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

module.exports = router;