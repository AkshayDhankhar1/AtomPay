const IdempotencyKey = require("../db/idempotencyKey");

const idempotency = () => (req, res, next) => {
    const key = req.headers["idempotency-key"];
    
    if (!key) {
        return next(); // no key = normal processing
    }

    const userId = req.user.id;

    // Check if this key was already processed
    IdempotencyKey.findOne({ key, user: userId })
        .then((existing) => {
            if (existing) {
                // Return cached response
                return res.status(existing.statusCode).json(existing.responseBody);
            }

            // Override res.json to capture the response
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                // Save the response for future duplicate requests
                IdempotencyKey.create({
                    key,
                    user: userId,
                    statusCode: res.statusCode,
                    responseBody: body
                }).catch((err) => {
                    // If duplicate key error (race condition), ignore
                    if (err.code !== 11000) {
                        console.log("Idempotency key save error:", err);
                    }
                });

                return originalJson(body);
            };

            next();
        })
        .catch((err) => {
            console.log("Idempotency check error:", err);
            next(); // on error, let request through
        });
};

module.exports = idempotency;
