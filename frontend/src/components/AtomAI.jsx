import { useState, useRef, useEffect } from "react";
import "../styles/atomai.css";

const SUGGESTIONS = [
  "📊 Analyze my spending this week",
  "💰 How much can I still send today?",
  "👤 Who do I send the most money to?",
  "💡 Tips to save money",
  "🔒 How do I keep my account safe?",
  "❓ How does AtomPay work?"
];

const BASE = "https://api.atompay.co.in/api";
// const BASE = "http://localhost:3000/api";

export default function AtomAI({ token, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Add placeholder for AI response
    const aiMsg = { role: "assistant", content: "" };
    setMessages([...newMessages, aiMsg]);

    try {
      const res = await fetch(`${BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10)
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.msg || "AI service unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.error) throw new Error(data.error);
              if (data.content) {
                fullContent += data.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent
                  };
                  return updated;
                });
              }
            } catch (e) {
              if (e.message !== "Unexpected end of JSON input") {
                // Only throw real errors, not partial JSON parse
                if (e.message.includes("AI")) throw e;
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, I encountered an issue: ${err.message}. Please try again.`
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Simple markdown-ish rendering
  const renderContent = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- /gm, '• ')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="ai-overlay" onClick={onClose} />}

      <div className={`ai-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-avatar">
              <span className="ai-avatar-icon">✦</span>
              <span className="ai-avatar-pulse" />
            </div>
            <div>
              <h3 className="ai-title">Atom AI</h3>
              <span className="ai-subtitle">Your financial assistant</span>
            </div>
          </div>
          <button className="ai-close" onClick={onClose}>✕</button>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.length === 0 && (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">✦</div>
              <h3>Hey there! I'm Atom AI ⚡</h3>
              <p>I can analyze your spending, answer questions about your account, and give financial tips.</p>

              <div className="ai-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="ai-suggestion"
                    onClick={() => sendMessage(s.replace(/^[^\s]+ /, ""))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="ai-msg-avatar">✦</div>
              )}
              <div className="ai-msg-bubble">
                {msg.content ? (
                  <div dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                ) : (
                  <div className="ai-typing">
                    <span /><span /><span />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="ai-input-area">
          <div className="ai-input-wrap">
            <input
              ref={inputRef}
              className="ai-input"
              placeholder="Ask Atom AI anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              maxLength={1000}
            />
            <button
              className="ai-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </div>
          <p className="ai-disclaimer">Atom AI can make mistakes. Verify important information.</p>
        </div>
      </div>
    </>
  );
}
