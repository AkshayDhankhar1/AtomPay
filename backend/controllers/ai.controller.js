const User = require("../db/users");
const Wallet = require("../db/wallet");
const Transaction = require("../db/transections");
const { streamChat } = require("../utils/groq");

/**
 * Build a rich system prompt with the user's financial context
 */
const buildSystemPrompt = (username, wallet, transactions) => {
    const balance = wallet?.balance ?? 0;
    const status = wallet?.status ?? "Unknown";

    // Calculate spending analytics
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const debits = transactions.filter(t => t.type === "debit" && t.status === "success");
    const credits = transactions.filter(t => t.type === "credit" && t.status === "success");

    const dailySpent = debits
        .filter(t => new Date(t.createdAt) >= oneDayAgo)
        .reduce((sum, t) => sum + t.amount, 0);

    const weeklySpent = debits
        .filter(t => new Date(t.createdAt) >= oneWeekAgo)
        .reduce((sum, t) => sum + t.amount, 0);

    const weeklyReceived = credits
        .filter(t => new Date(t.createdAt) >= oneWeekAgo)
        .reduce((sum, t) => sum + t.amount, 0);

    const weeklyTxCount = transactions.filter(
        t => new Date(t.createdAt) >= oneWeekAgo && t.status === "success"
    ).length;

    // Top recipients
    const peerMap = {};
    debits.forEach(t => {
        const peer = t.receiverUsername || t.peerUsername || "unknown";
        peerMap[peer] = (peerMap[peer] || 0) + t.amount;
    });
    const topPeers = Object.entries(peerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => `@${name}: ₹${amount.toLocaleString("en-IN")}`)
        .join(", ");

    const avgTxn = debits.length > 0
        ? Math.round(debits.reduce((s, t) => s + t.amount, 0) / debits.length)
        : 0;

    // Format recent transactions for context
    const recentTxns = transactions.slice(0, 20).map((t, i) => {
        const type = t.type === "debit" ? "SENT" : "RECEIVED";
        const peer = t.type === "debit"
            ? (t.receiverUsername || t.peerUsername)
            : (t.senderUsername || t.peerUsername);
        const date = new Date(t.createdAt).toLocaleString("en-IN", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
        return `${i + 1}. ${type} ₹${t.amount.toLocaleString("en-IN")} ${type === "SENT" ? "to" : "from"} @${peer || "unknown"} — ${date}${t.note ? ` (Note: ${t.note})` : ""}`;
    }).join("\n");

    return `You are **Atom AI** ⚡, the intelligent financial assistant built into AtomPay — India's lightning-fast payment wallet.

PERSONALITY:
- Friendly, concise, and financially savvy
- Use emojis sparingly (1-2 per response max)
- Format currency in Indian style: ₹1,00,000 (not ₹100,000)
- Keep responses short (2-4 sentences) unless the user asks for detailed analysis
- Use bullet points and bold text for readability

USER CONTEXT:
- Username: @${username}
- Wallet Balance: ₹${balance.toLocaleString("en-IN")}
- Wallet Status: ${status}
- Daily Limit Used: ₹${dailySpent.toLocaleString("en-IN")} / ₹1,00,000
- Daily Limit Remaining: ₹${(100000 - dailySpent).toLocaleString("en-IN")}

SPENDING SUMMARY (Last 7 Days):
- Total Sent: ₹${weeklySpent.toLocaleString("en-IN")} across ${weeklyTxCount} transactions
- Total Received: ₹${weeklyReceived.toLocaleString("en-IN")}
- Net Flow: ${weeklyReceived >= weeklySpent ? "+" : ""}₹${(weeklyReceived - weeklySpent).toLocaleString("en-IN")}
- Average Transaction: ₹${avgTxn.toLocaleString("en-IN")}
- Top Recipients: ${topPeers || "None yet"}

RECENT TRANSACTIONS (Last 20):
${recentTxns || "No transactions yet."}

RULES:
1. Never reveal the user's PIN, password, or full balance to anyone they might share the chat with — if asked, remind them to keep it private
2. If asked to send money or make a transaction, politely explain they should use the "Send Money" feature in the app
3. You can analyze spending, provide budgeting tips, explain AtomPay features, and answer general finance questions
4. If you don't know something specific about the user's account, say so honestly
5. AtomPay features: Send money, QR code payments, transaction history, ₹5,000 signup bonus, ₹1,00,000 daily limit, 6-digit PIN security, OTP-based login
6. Always respond in English`;
};

exports.chatStream = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, history = [] } = req.body;

        // Fetch user context
        const user = await User.findById(userId).select("username");
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        const wallet = await Wallet.findOne({ user: userId });
        const txDocs = await Transaction.find({
            $or: [
                { fromWallet: wallet?._id },
                { toWallet: wallet?._id }
            ]
        }).sort({ createdAt: -1 }).limit(50);

        // Transform transactions with type
        const transactions = txDocs.map(tx => {
            const isDebit = tx.fromWallet.toString() === wallet?._id?.toString();
            return {
                ...tx.toObject(),
                type: isDebit ? "debit" : "credit",
                peerUsername: isDebit ? tx.receiverUsername : tx.senderUsername
            };
        });

        const systemPrompt = buildSystemPrompt(user.username, wallet, transactions);

        // Build message history (limit to last 10 messages for context window)
        const chatMessages = history.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));
        chatMessages.push({ role: "user", content: message });

        // Set up SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        // Stream the response
        const stream = await streamChat(systemPrompt, chatMessages);

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (err) {
        console.log("AI Chat Error:", err);

        // If headers already sent (mid-stream error), send error via SSE
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: "AI response interrupted. Please try again." })}\n\n`);
            res.end();
        } else {
            return res.status(500).json({
                msg: "AI service is temporarily unavailable. Please try again."
            });
        }
    }
};
