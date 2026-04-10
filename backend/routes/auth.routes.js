const express = require("express");
const router = express.Router();
const {
    signup, login,
    changePassword, changePin,
    sendOTP, verifyOTP,
    refresh, logout
} = require("../controllers/auth.controller");

const {
    signupSchema, loginSchema,
    changePasswordSchema, changePinSchema,
    sendOTPSchema, verifyOTPSchema,
    refreshSchema, logoutSchema
} = require("../validators/auth.schema");
const authMiddleware = require("../middlewares/auth.middlewares");
const { validate } = require("../middlewares/validate");
const { rateLimiter } = require("../middlewares/rateLimiter");

// Rate limiters for auth endpoints
const signupLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many signup attempts, please try again after 15 minutes." });
const loginLimiter  = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts, please try again after 15 minutes." });

router.post("/signup", signupLimiter, validate(signupSchema), signup);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.patch("/change-password", authMiddleware, validate(changePasswordSchema), changePassword);
router.patch("/change-pin", authMiddleware, validate(changePinSchema), changePin);
router.post("/send-otp", validate(sendOTPSchema), sendOTP);
router.post("/verify-otp", validate(verifyOTPSchema), verifyOTP);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", authMiddleware, validate(logoutSchema), logout);

module.exports = router;