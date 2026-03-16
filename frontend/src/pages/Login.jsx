import { useState } from "react";
import { api } from "../api";
import "../styles/auth.css";

export default function Login({ onLogin, goToSignup }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Fill all fields");
    setLoading(true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-glow" />
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-atom">⚡</span>
          <span className="logo-text">AtomPay</span>
        </div>
        <p className="auth-subtitle">India ka naya payment wallet</p>

        <div className="auth-form">
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner" /> : "Login"}
          </button>

          <p className="auth-switch">
            Account nahi hai?{" "}
            <span onClick={goToSignup}>Sign up karo</span>
          </p>
        </div>
      </div>
    </div>
  );
}