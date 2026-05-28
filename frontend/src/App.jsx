import { useState, useEffect } from "react";
import { api } from "./api";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Transfer from "./pages/Transfer";
import Transactions from "./pages/Transactions";
import Settings from "./pages/Settings";
import Maintenance from "./pages/Maintenance";
import SideNav from "./components/SideNav";
import AtomAI from "./components/AtomAI";
import "./styles/atomai.css";

export default function App() {
  const [page, setPage] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [transferData, setTransferData] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const maintenance = import.meta.env.VITE_MAINTENANCE_MODE === "true";

  useEffect(() => {
    if (token) setPage("dashboard");

    // Set up token refresh callback
    window.__onTokenRefresh = (newToken) => {
      setToken(newToken);
    };

    return () => {
      window.__onTokenRefresh = null;
    };
  }, []);

  // Show maintenance page when env flag is set
  if (maintenance) {
    return <Maintenance />;
  }

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
    setAiOpen(false);
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
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <SideNav
        active={page}
        navigate={navigate}
        user={user}
        onLogout={handleLogout}
        onToggleAI={() => setAiOpen(!aiOpen)}
        aiOpen={aiOpen}
      />

      {/* Main Content */}
      <main className="app-main">
        {page === "dashboard" && <Dashboard token={token} user={user} navigate={navigate} onLogout={handleLogout} onOpenAI={() => setAiOpen(true)} />}
        {page === "transfer" && <Transfer token={token} navigate={navigate} initialData={transferData} />}
        {page === "transactions" && <Transactions token={token} navigate={navigate} />}
        {page === "settings" && <Settings token={token} user={user} navigate={navigate} onLogout={handleLogout} />}
      </main>

      {/* AI Panel */}
      <AtomAI token={token} isOpen={aiOpen} onClose={() => setAiOpen(false)} />

      {/* Mobile AI FAB */}
      <button className="ai-fab" onClick={() => setAiOpen(true)} aria-label="Open Atom AI">
        <span>✦</span>
        <span className="ai-fab-ring" />
      </button>
    </div>
  );
}