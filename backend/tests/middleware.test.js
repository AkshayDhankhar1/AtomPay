const jwt = require("jsonwebtoken");
const { setupDB } = require("./setup");
const authMiddleware = require("../middlewares/auth.middlewares");
const { rateLimiter } = require("../middlewares/rateLimiter");
const { validate } = require("../middlewares/validate");
const { loginSchema } = require("../validators/auth.schema");

setupDB();

// ─── AUTH MIDDLEWARE ──────────────────────────────────────
describe("Auth Middleware", () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    it("should call next() with valid token", () => {
        const token = jwt.sign({ userId: "user123" }, process.env.JWT_SECRET, { expiresIn: "15m" });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe("user123");
    });

    it("should return 401 when no token provided", () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ msg: "No token provided" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for invalid token", () => {
        const req = { headers: { authorization: "Bearer invalidtoken123" } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ msg: "Invalid token" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", () => {
        const token = jwt.sign({ userId: "user123" }, process.env.JWT_SECRET, { expiresIn: "0s" });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        // Small delay to ensure token is expired
        setTimeout(() => {
            authMiddleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ msg: expect.stringMatching(/expired/i) })
            );
            expect(next).not.toHaveBeenCalled();
        }, 10);
    });
});

// ─── RATE LIMITER ────────────────────────────────────────
describe("Rate Limiter Middleware", () => {
    const mockReq = (ip = "127.0.0.1") => ({
        ip,
        connection: { remoteAddress: ip }
    });

    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.setHeader = jest.fn();
        return res;
    };

    it("should allow requests within the limit", () => {
        const limiter = rateLimiter({ windowMs: 60000, max: 5 });
        const req = mockReq("10.0.0.1");
        const res = mockRes();
        const next = jest.fn();

        limiter(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 4);
    });

    it("should return 429 when limit is exceeded", () => {
        const limiter = rateLimiter({ windowMs: 60000, max: 2, message: "Slow down!" });
        const ip = "10.0.0.2";

        // Make 3 requests (limit is 2)
        for (let i = 0; i < 3; i++) {
            const req = mockReq(ip);
            const res = mockRes();
            const next = jest.fn();
            limiter(req, res, next);

            if (i < 2) {
                expect(next).toHaveBeenCalled();
            } else {
                expect(res.status).toHaveBeenCalledWith(429);
                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({ message: "Slow down!" })
                );
            }
        }
    });

    it("should track limits per IP separately", () => {
        const limiter = rateLimiter({ windowMs: 60000, max: 1 });

        // First IP — should pass
        const req1 = mockReq("10.0.0.3");
        const res1 = mockRes();
        const next1 = jest.fn();
        limiter(req1, res1, next1);
        expect(next1).toHaveBeenCalled();

        // Different IP — should also pass
        const req2 = mockReq("10.0.0.4");
        const res2 = mockRes();
        const next2 = jest.fn();
        limiter(req2, res2, next2);
        expect(next2).toHaveBeenCalled();
    });
});

// ─── VALIDATION MIDDLEWARE ───────────────────────────────
describe("Validation Middleware", () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    it("should call next() when body matches schema", () => {
        const middleware = validate(loginSchema);
        const req = { body: { email: "test@test.com", password: "password123" } };
        const res = mockRes();
        const next = jest.fn();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("should return 400 when body is invalid", () => {
        const middleware = validate(loginSchema);
        const req = { body: { email: "not-an-email" } };
        const res = mockRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ msg: "Invalid input provided" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 with empty body", () => {
        const middleware = validate(loginSchema);
        const req = { body: {} };
        const res = mockRes();
        const next = jest.fn();

        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});
