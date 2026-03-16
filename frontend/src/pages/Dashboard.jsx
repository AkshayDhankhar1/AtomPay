import { useState, useEffect } from "react";
import { api } from "../api";
import BottomNav from "../components/BottomNav";
import "../styles/dashboard.css";

export default function Dashboard({ token, user, navigate, onLogout }) {
  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [w, t] = await Promise.all([
          api("/wallet/balance", {}, token),
          api("/wallet/transactions", {}, token),
        ]);
        setWallet(w);
        setTxns(t.slice(0, 5));
      } catch (err) {
        if (err.message.includes("expired")) onLogout();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatAmount = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div className="loading-screen">
      <span className="logo-atom spinning">⚡</span>
    </div>
  );

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dash-header">
        <div>
          <p className="dash-greeting">Namaste 👋</p>
          <h2 className="dash-name">{user?.username}</h2>
        </div>
        <div className="dash-avatar" onClick={() => navigate("settings")}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-card-glow" />
        <div className="balance-top">
          <span className="balance-label">Wallet Balance</span>
          <button className="eye-btn" onClick={() => setBalanceVisible(!balanceVisible)}>
            {balanceVisible ? "👁" : "🙈"}
          </button>
        </div>
        <div className="balance-amount">
          {balanceVisible ? formatAmount(wallet?.balance ?? 0) : "₹ ••••••"}
        </div>
        <div className="balance-meta">
          <span className={`wallet-status ${wallet?.status?.toLowerCase()}`}>{wallet?.status}</span>
          <span className="balance-curr">{wallet?.currency}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn primary" onClick={() => navigate("transfer")}>
          <span className="action-icon">↑</span>
          <span>Send</span>
        </button>
        <button className="action-btn" onClick={() => navigate("transactions")}>
          <span className="action-icon">☰</span>
          <span>History</span>
        </button>
        <button className="action-btn" onClick={() => navigate("settings")}>
          <span className="action-icon">⚙</span>
          <span>Settings</span>
        </button>
      </div>

      {/* Daily Limit Bar */}
      <div className="limit-bar-section">
        <div className="limit-bar-header">
          <span>Daily Limit Used</span>
          <span className="limit-bar-amt">
            {formatAmount(txns.filter(t => t.type === "debit").reduce((a, b) => a + b.amount, 0))} / ₹1,00,000
          </span>
        </div>
        <div className="limit-bar-track">
          <div
            className="limit-bar-fill"
            style={{
              width: `${Math.min(
                (txns.filter(t => t.type === "debit").reduce((a, b) => a + b.amount, 0) / 100000) * 100, 100
              )}%`
            }}
          />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="recent-section">
        <div className="recent-header">
          <h3>Recent Transactions</h3>
          <span onClick={() => navigate("transactions")}>View all →</span>
        </div>

        {txns.length === 0 ? (
          <div className="empty-txn">
            <p>Abhi tak koi transaction nahi</p>
            <button onClick={() => navigate("transfer")}>Pehla payment bhejo ⚡</button>
          </div>
        ) : (
          txns.map((tx, i) => (
            <div className="txn-item" key={i}>
              <div className={`txn-icon ${tx.type}`}>
                {tx.type === "debit" ? "↑" : "↓"}
              </div>
              <div className="txn-details">
                <span className="txn-id">{tx.transactionId?.slice(0, 12)}...</span>
                <span className="txn-date">{formatDate(tx.createdAt)}</span>
              </div>
              <div className={`txn-amount ${tx.type}`}>
                {tx.type === "debit" ? "-" : "+"}{formatAmount(tx.amount)}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 80 }} />
      <BottomNav active="dashboard" navigate={navigate} />
    </div>
  );
}