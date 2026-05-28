const zod = require("zod");

exports.chatSchema = zod.object({
    message: zod.string().min(1).max(1000),
    history: zod.array(zod.object({
        role: zod.enum(["user", "assistant"]),
        content: zod.string()
    })).max(20).optional()
});
