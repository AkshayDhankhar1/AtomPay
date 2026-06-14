const Redis = require("ioredis");

/**
 * Centralized Redis connection management for AtomPay.
 *
 * Two distinct connection roles:
 *   1. Cache client  — a single shared, multiplexed ioredis client used for
 *      caching, rate limiting, and idempotency. This is the idiomatic Redis
 *      "pool": one connection that pipelines many commands. Reuse it everywhere.
 *   2. BullMQ connections — BullMQ REQUIRES `maxRetriesPerRequest: null` and
 *      its own dedicated connection per Queue/Worker; it must NOT share the
 *      cache client. `createBullConnection()` hands out fresh instances.
 *
 * Connection string comes from REDIS_URL. Use `rediss://` for TLS providers.
 */

let cacheClient = null;

function getRedisUrl() {
    if (!process.env.REDIS_URL) {
        throw new Error("REDIS_URL is not set in environment");
    }
    return process.env.REDIS_URL;
}

/**
 * Shared cache/rate-limit/idempotency client. Lazily created, reused forever.
 */
function getRedis() {
    if (cacheClient) return cacheClient;

    cacheClient = new Redis(getRedisUrl(), {
        // Fail fast instead of queueing commands forever when Redis is down.
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
            return Math.min(times * 200, 2000);
        },
    });

    cacheClient.on("connect", () => console.log("Redis (cache) connected ✅"));
    cacheClient.on("error", (err) => console.error("Redis (cache) error:", err.message));

    return cacheClient;
}

/**
 * Fresh dedicated connection for BullMQ (Queue/Worker/QueueEvents).
 * BullMQ blocks on commands, so it mandates maxRetriesPerRequest: null.
 */
function createBullConnection() {
    const conn = new Redis(getRedisUrl(), {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            return Math.min(times * 200, 2000);
        },
    });

    conn.on("error", (err) => console.error("Redis (bullmq) error:", err.message));
    return conn;
}

/**
 * Close the shared cache client. Used during graceful shutdown.
 * BullMQ connections are closed by their owning queues/workers.
 */
async function closeRedis() {
    if (cacheClient) {
        await cacheClient.quit();
        cacheClient = null;
    }
}

module.exports = { getRedis, createBullConnection, closeRedis };
