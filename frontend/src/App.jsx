import { useState, useEffect } from "react";
import { setForceLogout, api } from "./api";
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
  const [transferData, setTransferData] = useState(null);

  useEffect(() => {
    if (token) setPage("dashboard");

    // Set up force logout for api.js
    setForceLogout(handleLogout);

    // Set up token refresh callback
    window.__onTokenRefresh = (newToken) => {
      setToken(newToken);
    };

    return () => {
      window.__onTokenRefresh = null;
    };
  }, []);

  const handleLogin = (accessToken, refreshToken, userData) => {
    if (!accessToken || !refreshToken) {
      console.error("handleLogin called with missing tokens", { accessToken, refreshToken });
      return;
    }
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    setPage("dashboard");
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    const currentToken = localStorage.getItem("token");
    
    // Try to call logout endpoint (best effort)
    if (refreshToken && currentToken) {
      try {
        await api("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken })
        }, currentToken);
      } catch (e) {
        // Ignore errors during logout
      }
    }

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setTransferData(null);
    setPage("login");
  };

  const navigate = (pageName, data) => {
    if (pageName === "transfer" && data) {
      setTransferData(data);
    } else {
      setTransferData(null);
    }
    setPage(pageName);
  };

  if (!token) {
    return page === "signup"
      ? <Signup onLogin={handleLogin} goToLogin={() => setPage("login")} />
      : <Login onLogin={handleLogin} goToSignup={() => setPage("signup")} />;
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0f0f0f", position: "relative" }}>
      {page === "dashboard" && <Dashboard token={token} user={user} navigate={navigate} onLogout={handleLogout} />}
      {page === "transfer" && <Transfer token={token} navigate={navigate} initialData={transferData} />}
      {page === "transactions" && <Transactions token={token} navigate={navigate} />}
      {page === "settings" && <Settings token={token} user={user} navigate={navigate} onLogout={handleLogout} />}
    </div>
  );
}