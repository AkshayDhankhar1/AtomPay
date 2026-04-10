const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middlewares");
const { validate } = require("../middlewares/validate");
const { transferMoney } = require("../controllers/transections.controller");
const { transferSchema } = require("../validators/transfer.Schema");
const idempotency = require("../middlewares/idempotency");

router.post("/transfer", authMiddleware, validate(transferSchema), idempotency(), transferMoney);

module.exports = router;