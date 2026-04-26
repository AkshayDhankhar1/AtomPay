/**
 * In-memory rate limiter middleware.
 * No external packages required – uses a simple Map with automatic cleanup.
 *
 * Options:
 *   windowMs  – time window in milliseconds (default: 15 min)
 *   max       – max requests per window per IP (default: 10)
 *   message   – error message returned when limit is exceeded
 */

const rateLimiter = ({
    windowMs = 15 * 60 * 1000,  // 15 minutes
    max = 10,                   // 10 requests per window
    message = "Too many requests, please try again later.",
} = {}) => {
    // Map<string, { count: number, resetTime: number }>
    const hits = new Map();

    // Periodically clean up expired entries to prevent memory leaks
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (now >= entry.resetTime) {
                hits.delete(key);
            }
        }
    }, windowMs);

    // Allow the timer to not keep the process alive
    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }

    return (req, res, next) => {
        // Use IP address as the key (works behind most proxies when trust proxy is set)
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        let entry = hits.get(key);

        // First request or window expired → start a fresh window
        if (!entry || now >= entry.resetTime) {
            entry = { count: 1, resetTime: now + windowMs };
            hits.set(key, entry);
        } else {
            entry.count++;
        }

        // Set standard rate-limit headers so the client knows what's going on
        const remaining = Math.max(0, max - entry.count);
        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

        if (entry.count > max) {
            const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
            res.setHeader("Retry-After", retryAfterSec);
            return res.status(429).json({ message });
        }

        next();
    };
};

module.exports = { rateLimiter };
