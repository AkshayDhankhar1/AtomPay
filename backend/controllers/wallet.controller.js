const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");
const { cacheGet, cacheSet } = require("../db/cache");

// Read-through cache TTLs (also a safety net — both keys are explicitly
// invalidated on every successful transfer, so they never serve stale data).
const BALANCE_TTL = 300;   // 5 minutes
const TXNS_TTL = 30;       // 30 seconds

exports.getMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `cache:balance:${userId}`;

        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ msg: "Wallet not found" });
        }

        const payload = {
            balance: wallet.balance,
            currency: wallet.currency,
            status: wallet.status,
            qrCode: wallet.qrCode
        };
        await cacheSet(cacheKey, payload, BALANCE_TTL);
        res.json(payload);
    }
    catch (err) {
        res.status(500).json({ msg: err.message });
    }
}

exports.getMyTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `cache:txns:${userId}`;

        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ msg: "Wallet not found" });
        }
        const txs = await Transaction.find({
            $or: [
                { fromWallet: wallet._id },
                { toWallet: wallet._id }
            ]
        }).sort({ createdAt: -1 }).limit(50);

        const payload = txs.map(tx => {
            const isDebit = tx.fromWallet.toString() === wallet._id.toString();
            return {
                transactionId: tx.transactionId,
                amount: tx.amount,
                status: tx.status,
                type: isDebit ? "debit" : "credit",
                note: tx.note || null,
                senderUsername: tx.senderUsername || null,
                receiverUsername: tx.receiverUsername || null,
                peerUsername: isDebit ? tx.receiverUsername : tx.senderUsername,
                createdAt: tx.createdAt
            };
        });
        await cacheSet(cacheKey, payload, TXNS_TTL);
        res.json(payload);
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            msg: "Something went wrong"
        })
    }
}
