/**
 * Custom operational error classes for AtomPay.
 *
 * All extend AppError so a central handler can distinguish expected,
 * operational failures (isOperational = true) from unexpected bugs.
 */

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/** 429 — request rate limit exceeded. */
class RateLimitError extends AppError {
    constructor(message = "Too many requests, please try again later.", retryAfter = 60) {
        super(message, 429);
        this.retryAfter = retryAfter;
    }
}

/** 409 — a request with this Idempotency-Key is already in flight. */
class IdempotencyConflictError extends AppError {
    constructor(message = "A request with this Idempotency-Key is already being processed.") {
        super(message, 409);
    }
}

/** 400 — per-user money velocity cap (₹1,00,000 / 24h) would be exceeded. */
class VelocityLimitError extends AppError {
    constructor(message = "You cannot send more than ₹1,00,000 in 24 hours") {
        super(message, 400);
    }
}

module.exports = {
    AppError,
    RateLimitError,
    IdempotencyConflictError,
    VelocityLimitError,
};
