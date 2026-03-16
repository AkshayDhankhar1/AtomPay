import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Transfer from "./pages/Transfer";
import Transactions from "./pages/Transactions";
import Settings from "./pages/Settings";

export default function App() {
  const [page, setPage] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  useEffect(() => {
    if (token) setPage("dashboard");
  }, []);

  const handleLogin = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(token);
    setUser(user);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setPage("login");
  };

  if (!token) {
    return page === "login"
      ? <Login onLogin={handleLogin} goToSignup={() => setPage("signup")} />
      : <Signup onLogin={handleLogin} goToLogin={() => setPage("login")} />;
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0f0f0f", position: "relative" }}>
      {page === "dashboard" && <Dashboard token={token} user={user} navigate={setPage} onLogout={handleLogout} />}
      {page === "transfer" && <Transfer token={token} navigate={setPage} />}
      {page === "transactions" && <Transactions token={token} navigate={setPage} />}
      {page === "settings" && <Settings token={token} user={user} navigate={setPage} onLogout={handleLogout} />}
    </div>
  );
}