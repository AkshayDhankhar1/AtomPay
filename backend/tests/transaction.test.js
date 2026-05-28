const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { setupDB } = require("./setup");
const User = require("../db/users");
const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");
const { generateTokenPair } = require("../utils/jwt");

setupDB();

// Helper: create a user + wallet
const createTestUser = async (overrides = {}) => {
    const password = overrides.password || "testpassword123";
    const pin = overrides.pin || "123456";
    const hashedPass = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await User.create({
        name: overrides.name || "Test User",
        email: overrides.email || `user${Date.now()}@test.com`,
        password: hashedPass,
        username: overrides.username || `user${Date.now()}`,
        hashedPin,
        active: overrides.active !== undefined ? overrides.active : true,
        role: overrides.role || "User"
    });

    const wallet = await Wallet.create({
        user: user._id,
        balance: overrides.balance !== undefined ? overrides.balance : 500000,
        status: overrides.walletStatus || "Active",
        qrCode: "data:image/png;base64,fakeqr"
    });

    const tokens = await generateTokenPair(user._id);
    return { user, wallet, tokens, password, pin };
};

// ─── TRANSFER MONEY ──────────────────────────────────────
describe("POST /api/transaction/transfer", () => {
    it("should transfer money successfully", async () => {
        const sender = await createTestUser({
            email: "sender@test.com",
            username: "sender",
            balance: 10000
        });
        const receiver = await createTestUser({
            email: "receiver@test.com",
            username: "receiver",
            balance: 5000
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver",
                amount: 1000,
                pin: sender.pin,
                note: "Test transfer"
            });

        expect(res.status).toBe(200);
        expect(res.body.msg).toMatch(/sent successfully/i);

        // Verify balances changed
        const senderWallet = await Wallet.findOne({ user: sender.user._id });
        const receiverWallet = await Wallet.findOne({ user: receiver.user._id });
        expect(senderWallet.balance).toBe(9000);
        expect(receiverWallet.balance).toBe(6000);

        // Verify transaction was recorded
        const tx = await Transaction.findOne({ senderUsername: "sender" });
        expect(tx).toBeDefined();
        expect(tx.status).toBe("success");
        expect(tx.amount).toBe(1000);
    });

    it("should return 400 for amount less than 1", async () => {
        const sender = await createTestUser({
            email: "s2@test.com",
            username: "sender2"
        });
        await createTestUser({
            email: "r2@test.com",
            username: "receiver2"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver2",
                amount: 0,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
    });

    it("should return 400 for amount exceeding max (Zod validation)", async () => {
        const sender = await createTestUser({
            email: "s3@test.com",
            username: "sender3"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "someone",
                amount: 200000,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
    });

    it("should return 400 for wrong PIN", async () => {
        const sender = await createTestUser({
            email: "s4@test.com",
            username: "sender4"
        });
        await createTestUser({
            email: "r4@test.com",
            username: "receiver4"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver4",
                amount: 100,
                pin: "000000"
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toBeDefined();
    });

    it("should return 400 for insufficient balance", async () => {
        const sender = await createTestUser({
            email: "s5@test.com",
            username: "sender5",
            balance: 50
        });
        await createTestUser({
            email: "r5@test.com",
            username: "receiver5"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver5",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/sufficient|insufficient/i);
    });

    it("should return 400 for invalid receiver", async () => {
        const sender = await createTestUser({
            email: "s6@test.com",
            username: "sender6"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "nonexistentuser",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/invalid receiver/i);
    });

    it("should return 400 for self-transfer", async () => {
        const sender = await createTestUser({
            email: "s7@test.com",
            username: "sender7"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "sender7",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/yourself/i);
    });

    it("should return 400 when sender is inactive", async () => {
        const sender = await createTestUser({
            email: "s8@test.com",
            username: "sender8",
            active: false
        });
        await createTestUser({
            email: "r8@test.com",
            username: "receiver8"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver8",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/not active/i);
    });

    it("should return 400 when receiver is inactive", async () => {
        const sender = await createTestUser({
            email: "s9@test.com",
            username: "sender9"
        });
        await createTestUser({
            email: "r9@test.com",
            username: "receiver9",
            active: false
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver9",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/inactive/i);
    });

    it("should return 400 when sender wallet is frozen", async () => {
        const sender = await createTestUser({
            email: "s10@test.com",
            username: "sender10",
            walletStatus: "Frozen"
        });
        await createTestUser({
            email: "r10@test.com",
            username: "receiver10"
        });

        const res = await request(app)
            .post("/api/transaction/transfer")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`)
            .send({
                receiverUsername: "receiver10",
                amount: 100,
                pin: sender.pin
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toMatch(/frozen|closed/i);
    });

    it("should return 401 without auth token", async () => {
        const res = await request(app)
            .post("/api/transaction/transfer")
            .send({
                receiverUsername: "someone",
                amount: 100,
                pin: "123456"
            });
        expect(res.status).toBe(401);
    });
});
