const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");

exports.getMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ msg: "Wallet not found" });
        }
        res.json({
            balance: wallet.balance,
            currency: wallet.currency,
            status: wallet.status,
            qrCode: wallet.qrCode
        })
    }
    catch (err) {
        res.status(500).json({ msg: err.message });
    }
}

exports.getMyTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
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

        res.json(txs.map(tx => {
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
        }));
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            msg: "Something went wrong"
        })
    }
}