const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { setupDB } = require("./setup");
const User = require("../db/users");
const Wallet = require("../db/wallet");
const RefreshToken = require("../db/refreshToken");
const { generateTokenPair, generateAccessToken } = require("../utils/jwt");
const { generateOTP } = require("../utils/otp");

setupDB();

// Helper: create a user + wallet directly in DB (bypassing signup endpoint)
const createTestUser = async (overrides = {}) => {
    const password = overrides.password || "testpassword123";
    const pin = overrides.pin || "123456";
    const hashedPass = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await User.create({
        name: overrides.name || "Test User",
        email: overrides.email || "test@example.com",
        password: hashedPass,
        username: overrides.username || "testuser",
        hashedPin: hashedPin,
        active: overrides.active !== undefined ? overrides.active : true,
        role: overrides.role || "User"
    });

    await Wallet.create({
        user: user._id,
        balance: overrides.balance !== undefined ? overrides.balance : 500000,
        status: overrides.walletStatus || "Active",
        qrCode: "data:image/png;base64,fakeqr"
    });

    const tokens = await generateTokenPair(user._id);
    return { user, tokens, password, pin };
};

// ─── SIGNUP ──────────────────────────────────────────────
describe("POST /api/auth/signup", () => {
    it("should return 400 for missing fields (Zod validation)", async () => {
        const res = await request(app)
            .post("/api/auth/signup")
            .send({ email: "a@b.com" });
        expect(res.status).toBe(400);
        expect(res.body.msg).toBe("Invalid input provided");
    });

    it("should return 400 for invalid pin (not 6 digits)", async () => {
        // Need a valid OTP for the signup flow — generate one
        const email = "newuser@example.com";
        const otp = generateOTP(email);

        const res = await request(app)
            .post("/api/auth/signup")
            .send({
                name: "New User",
                email,
                password: "password123",
                username: "newuser",
                pin: "12",  // invalid — caught by Zod validation
                otp
            });
        expect(res.status).toBe(400);
    });

    it("should return 400 for duplicate email", async () => {
        await createTestUser({ email: "dup@example.com", username: "dupuser1" });
        const otp = generateOTP("dup@example.com");

        const res = await request(app)
            .post("/api/auth/signup")
            .send({
                name: "Dup User",
                email: "dup@example.com",
                password: "password123",
                username: "dupuser2",
                pin: "123456",
                otp
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/email already exists/i);
    });

    it("should return 400 for duplicate username", async () => {
        await createTestUser({ email: "unique@example.com", username: "takenuser" });
        const email2 = "another@example.com";
        const otp = generateOTP(email2);

        const res = await request(app)
            .post("/api/auth/signup")
            .send({
                name: "Another User",
                email: email2,
                password: "password123",
                username: "takenuser",
                pin: "654321",
                otp
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/username already exists/i);
    });

    it("should signup successfully with valid data and OTP", async () => {
        const email = "fresh@example.com";
        const otp = generateOTP(email);

        const res = await request(app)
            .post("/api/auth/signup")
            .send({
                name: "Fresh User",
                email,
                password: "password123",
                username: "freshuser",
                pin: "111111",
                otp
            });
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.user.username).toBe("freshuser");
    });

    it("should return 400 for wrong/expired OTP", async () => {
        const res = await request(app)
            .post("/api/auth/signup")
            .send({
                name: "Bad OTP",
                email: "badotp@example.com",
                password: "password123",
                username: "badotp",
                pin: "123456",
                otp: "000000"
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/wrong or expired otp/i);
    });
});

// ─── LOGIN ───────────────────────────────────────────────
describe("POST /api/auth/login", () => {
    it("should login successfully with correct credentials", async () => {
        const { password } = await createTestUser({
            email: "login@example.com",
            username: "loginuser"
        });
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "login@example.com", password });
        expect(res.status).toBe(200);
        expect(res.body.msg).toMatch(/login successful/i);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
    });

    it("should return 404 for non-existent user", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "ghost@example.com", password: "password123" });
        expect(res.status).toBe(404);
        expect(res.body.msg).toMatch(/does not exist/i);
    });

    it("should return 401 for wrong password", async () => {
        await createTestUser({
            email: "wrongpw@example.com",
            username: "wrongpwuser"
        });
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "wrongpw@example.com", password: "wrongwrong123" });
        expect(res.status).toBe(401);
        expect(res.body.msg).toMatch(/wrong password/i);
    });
});

// ─── CHANGE PASSWORD ─────────────────────────────────────
describe("PATCH /api/auth/change-password", () => {
    it("should change password successfully", async () => {
        const { tokens, password } = await createTestUser({
            email: "chpw@example.com",
            username: "chpwuser"
        });
        const res = await request(app)
            .patch("/api/auth/change-password")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPassword: password, newPassword: "newpassword123" });
        expect(res.status).toBe(200);
        expect(res.body.msg).toMatch(/password changed/i);
    });

    it("should return 401 for wrong old password", async () => {
        const { tokens } = await createTestUser({
            email: "chpw2@example.com",
            username: "chpw2user"
        });
        const res = await request(app)
            .patch("/api/auth/change-password")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPassword: "totallyWrong1", newPassword: "newpassword123" });
        expect(res.status).toBe(401);
    });

    it("should return 400 for short new password", async () => {
        const { tokens, password } = await createTestUser({
            email: "chpw3@example.com",
            username: "chpw3user"
        });
        const res = await request(app)
            .patch("/api/auth/change-password")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPassword: password, newPassword: "short" });
        // Zod validation catches this before the controller
        expect(res.status).toBe(400);
    });

    it("should return 401 without auth token", async () => {
        const res = await request(app)
            .patch("/api/auth/change-password")
            .send({ oldPassword: "test", newPassword: "newpassword123" });
        expect(res.status).toBe(401);
    });
});

// ─── CHANGE PIN ──────────────────────────────────────────
describe("PATCH /api/auth/change-pin", () => {
    it("should change PIN successfully", async () => {
        const { tokens, pin } = await createTestUser({
            email: "chpin@example.com",
            username: "chpinuser"
        });
        const res = await request(app)
            .patch("/api/auth/change-pin")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPin: pin, newPin: "999999" });
        expect(res.status).toBe(200);
        expect(res.body.msg).toMatch(/pin changed/i);
    });

    it("should return 401 for wrong old PIN", async () => {
        const { tokens } = await createTestUser({
            email: "chpin2@example.com",
            username: "chpin2user"
        });
        const res = await request(app)
            .patch("/api/auth/change-pin")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPin: "000000", newPin: "999999" });
        expect(res.status).toBe(401);
        expect(res.body.msg).toMatch(/incorrect pin/i);
    });

    it("should return 400 for invalid new PIN length", async () => {
        const { tokens, pin } = await createTestUser({
            email: "chpin3@example.com",
            username: "chpin3user"
        });
        const res = await request(app)
            .patch("/api/auth/change-pin")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ oldPin: pin, newPin: "12" });
        // Zod validation catches invalid PIN format before the controller
        expect(res.status).toBe(400);
    });
});

// ─── REFRESH TOKEN ───────────────────────────────────────
describe("POST /api/auth/refresh", () => {
    it("should return new access token with valid refresh token", async () => {
        const { tokens } = await createTestUser({
            email: "refresh@example.com",
            username: "refreshuser"
        });
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: tokens.refreshToken });
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
    });

    it("should return 401 for invalid refresh token", async () => {
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: "totally-fake-token-abc123" });
        expect(res.status).toBe(401);
    });

    it("should return 401 for revoked refresh token", async () => {
        const { tokens } = await createTestUser({
            email: "revoked@example.com",
            username: "revokeduser"
        });
        // Revoke the token
        await RefreshToken.findOneAndUpdate(
            { token: tokens.refreshToken },
            { revoked: true }
        );
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: tokens.refreshToken });
        expect(res.status).toBe(401);
        expect(res.body.msg).toMatch(/revoked/i);
    });

    it("should return 401 for expired refresh token", async () => {
        const { tokens } = await createTestUser({
            email: "expired@example.com",
            username: "expireduser"
        });
        // Expire the token
        await RefreshToken.findOneAndUpdate(
            { token: tokens.refreshToken },
            { expiresAt: new Date(Date.now() - 1000) }
        );
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: tokens.refreshToken });
        expect(res.status).toBe(401);
        expect(res.body.msg).toMatch(/expired/i);
    });

    it("should return 400 when no refresh token is sent", async () => {
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({});
        // Zod validation catches missing required field
        expect([400, 401]).toContain(res.status);
    });
});

// ─── LOGOUT ──────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
        const { tokens } = await createTestUser({
            email: "logout@example.com",
            username: "logoutuser"
        });
        const res = await request(app)
            .post("/api/auth/logout")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({ refreshToken: tokens.refreshToken });
        expect(res.status).toBe(200);
        expect(res.body.msg).toMatch(/logged out/i);

        // Verify the refresh token is revoked
        const tokenDoc = await RefreshToken.findOne({ token: tokens.refreshToken });
        expect(tokenDoc.revoked).toBe(true);
    });

    it("should logout even without refresh token body", async () => {
        const { tokens } = await createTestUser({
            email: "logout2@example.com",
            username: "logout2user"
        });
        const res = await request(app)
            .post("/api/auth/logout")
            .set("Authorization", `Bearer ${tokens.accessToken}`)
            .send({});
        expect(res.status).toBe(200);
    });
});
