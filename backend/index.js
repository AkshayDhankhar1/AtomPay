require('dotenv').config();
const mongoose = require("mongoose");
const connectDB = require("./db/db");
const app = require("./app");
const { getRedis, closeRedis } = require("./db/redis");
const { closeQueues } = require("./queues");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    if (!process.env.MONGO_URL) throw new Error('Mongo url required');
    await connectDB();
    getRedis(); // pre-warm the Redis connection at boot, not on first request

    const server = app.listen(PORT, () => {
        console.log(`server running on port ${PORT} ✅`);
    });

    // Graceful shutdown: stop accepting new requests, let in-flight ones finish,
    // then close DB / Redis / queue connections.
    const shutdown = async (signal) => {
        console.log(`${signal} received — shutting down gracefully...`);
        server.close(async () => {
            try {
                await closeQueues();
                await mongoose.connection.close();
                await closeRedis();
            } catch (err) {
                console.log("shutdown error:", err.message);
            }
            process.exit(0);
        });
        // Safety net — force exit if something hangs.
        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
};
startServer();
