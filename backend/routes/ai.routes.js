const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middlewares");
const { validate } = require("../middlewares/validate");
const { rateLimiter } = require("../middlewares/rateLimiter");
const { chatSchema } = require("../validators/ai.schema");
const { chatStream } = require("../controllers/ai.controller");

// Rate limiter: 20 AI messages per 15 minutes
const aiLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many AI requests. Please wait a few minutes."
});

router.post("/chat", authMiddleware, aiLimiter, validate(chatSchema), chatStream);

module.exports = router;
