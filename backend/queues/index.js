const { Queue } = require("bullmq");
const { createBullConnection } = require("../db/redis");

// Producers only. Workers live in workers/ and run in a separate process
// (npm run start:worker). One shared connection is fine for producing.
const connection = createBullConnection();

const emailQueue = new Queue("email", { connection });
const auditQueue = new Queue("audit", { connection });

// Retry transient failures with exponential backoff; auto-trim old jobs.
const jobOpts = {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};

// Fire-and-forget producers — fail OPEN so a Redis/queue issue never affects the
// request that triggered them (the money has already moved safely).
const enqueueEmail = (data) => {
    emailQueue.add("email", data, jobOpts).catch((err) => console.log("enqueueEmail error:", err.message));
};

const enqueueAudit = (data) => {
    auditQueue.add("audit", data, jobOpts).catch((err) => console.log("enqueueAudit error:", err.message));
};

const closeQueues = async () => {
    await emailQueue.close();
    await auditQueue.close();
    await connection.quit();
};

module.exports = { emailQueue, auditQueue, enqueueEmail, enqueueAudit, closeQueues };
