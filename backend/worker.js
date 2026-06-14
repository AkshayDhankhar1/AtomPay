require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./db/db");
const startEmailWorker = require("./workers/email.worker");
const startAuditWorker = require("./workers/audit.worker");
const { closeRedis } = require("./db/redis");

// Separate process from the API: npm run start:worker
const start = async () => {
    if (!process.env.MONGO_URL) throw new Error("Mongo url required");
    await connectDB();

    const workers = [startEmailWorker(), startAuditWorker()];
    console.log("Workers running ✅");

    // Graceful shutdown — let active jobs finish before exiting.
    const shutdown = async (signal) => {
        console.log(`${signal} received — draining workers...`);
        try {
            await Promise.all(workers.map((w) => w.close())); // waits for in-flight jobs
            await mongoose.connection.close();
            await closeRedis();
        } catch (err) {
            console.log("worker shutdown error:", err.message);
        }
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
};

start();
