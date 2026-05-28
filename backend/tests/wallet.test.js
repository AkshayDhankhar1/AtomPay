const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { setupDB } = require("./setup");
const User = require("../db/users");
const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");
const { generateTokenPair } = require("../utils/jwt");

setupDB();

// Helper
const createTestUser = async (overrides = {}) => {
    const password = overrides.password || "testpassword123";
    const pin = overrides.pin || "123456";
    const hashedPass = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await User.create({
        name: overrides.name || "Test User",
        email: overrides.email || `walletuser${Date.now()}@test.com`,
        password: hashedPass,
        username: overrides.username || `walletuser${Date.now()}`,
        hashedPin,
        active: true
    });

    const wallet = await Wallet.create({
        user: user._id,
        balance: overrides.balance !== undefined ? overrides.balance : 500000,
        status: "Active",
        qrCode: "data:image/png;base64,fakeqr"
    });

    const tokens = await generateTokenPair(user._id);
    return { user, wallet, tokens };
};

// ─── GET WALLET BALANCE ──────────────────────────────────
describe("GET /api/wallet/balance", () => {
    it("should return wallet details with balance, currency, status, qrCode", async () => {
        const { tokens } = await createTestUser({
            email: "walbal@test.com",
            username: "walbaluser",
            balance: 42000
        });

        const res = await request(app)
            .get("/api/wallet/balance")
            .set("Authorization", `Bearer ${tokens.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe(42000);
        expect(res.body.currency).toBe("INR");
        expect(res.body.status).toBe("Active");
        expect(res.body.qrCode).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
        const res = await request(app).get("/api/wallet/balance");
        expect(res.status).toBe(401);
    });
});

// ─── GET TRANSACTIONS ────────────────────────────────────
describe("GET /api/wallet/transactions", () => {
    it("should return empty array when no transactions exist", async () => {
        const { tokens } = await createTestUser({
            email: "notx@test.com",
            username: "notxuser"
        });

        const res = await request(app)
            .get("/api/wallet/transactions")
            .set("Authorization", `Bearer ${tokens.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it("should return transactions with correct debit/credit type", async () => {
        // Create two users and a transaction between them
        const sender = await createTestUser({
            email: "txsender@test.com",
            username: "txsender",
            balance: 10000
        });
        const receiver = await createTestUser({
            email: "txreceiver@test.com",
            username: "txreceiver",
            balance: 5000
        });

        // Create a direct transaction record
        await Transaction.create({
            transactionId: "test-tx-id-001",
            fromWallet: sender.wallet._id,
            toWallet: receiver.wallet._id,
            amount: 500,
            status: "success",
            senderUsername: "txsender",
            receiverUsername: "txreceiver",
            note: "Test note"
        });

        // Sender should see it as debit
        const senderRes = await request(app)
            .get("/api/wallet/transactions")
            .set("Authorization", `Bearer ${sender.tokens.accessToken}`);

        expect(senderRes.status).toBe(200);
        expect(senderRes.body.length).toBe(1);
        expect(senderRes.body[0].type).toBe("debit");
        expect(senderRes.body[0].amount).toBe(500);
        expect(senderRes.body[0].peerUsername).toBe("txreceiver");
        expect(senderRes.body[0].note).toBe("Test note");

        // Receiver should see it as credit
        const receiverRes = await request(app)
            .get("/api/wallet/transactions")
            .set("Authorization", `Bearer ${receiver.tokens.accessToken}`);

        expect(receiverRes.status).toBe(200);
        expect(receiverRes.body.length).toBe(1);
        expect(receiverRes.body[0].type).toBe("credit");
        expect(receiverRes.body[0].peerUsername).toBe("txsender");
    });

    it("should return transactions sorted by latest first", async () => {
        const user1 = await createTestUser({
            email: "sorted1@test.com",
            username: "sorted1"
        });
        const user2 = await createTestUser({
            email: "sorted2@test.com",
            username: "sorted2"
        });

        // Create two transactions with slight time gap
        await Transaction.create({
            transactionId: "tx-old",
            fromWallet: user1.wallet._id,
            toWallet: user2.wallet._id,
            amount: 100,
            status: "success",
            senderUsername: "sorted1",
            receiverUsername: "sorted2",
            createdAt: new Date("2025-01-01")
        });

        await Transaction.create({
            transactionId: "tx-new",
            fromWallet: user1.wallet._id,
            toWallet: user2.wallet._id,
            amount: 200,
            status: "success",
            senderUsername: "sorted1",
            receiverUsername: "sorted2",
            createdAt: new Date("2025-06-01")
        });

        const res = await request(app)
            .get("/api/wallet/transactions")
            .set("Authorization", `Bearer ${user1.tokens.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        // Newest first
        expect(res.body[0].amount).toBe(200);
        expect(res.body[1].amount).toBe(100);
    });

    it("should return 401 without auth token", async () => {
        const res = await request(app).get("/api/wallet/transactions");
        expect(res.status).toBe(401);
    });
});
