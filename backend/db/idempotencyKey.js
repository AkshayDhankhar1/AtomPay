const mongoose = require("mongoose");

const idempotencyKeySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index: same key per user
idempotencyKeySchema.index({ key: 1, user: 1 }, { unique: true });

// Auto-delete after 24 hours
idempotencyKeySchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 86400 }
);

module.exports = mongoose.model("IdempotencyKey", idempotencyKeySchema);
