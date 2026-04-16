"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    {
      role: "assistant",
      content:
        "Heyy, I’m Glow Up Bot 💄 Ask me about makeup, hairstyles, skincare, or outfit ideas.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim()) return;

    const updatedHistory = [...chatHistory, { role: "user", content: message }];
    setChatHistory(updatedHistory);
    setLoading(true);

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          messages: updatedHistory,
          profile: {},
        }),
      });

      const data = await response.json();

      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content: data.reply || "No response came back from the bot.",
        },
      ]);
      setMessage("");
    } catch (error) {
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content: "Something went wrong connecting to the backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #1a1a1a, #2d0b45)",
        color: "white",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: "bold",
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          Glow Up Bot 💄
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#f3d9ff",
            marginBottom: "30px",
            fontSize: "1.1rem",
          }}
        >
          Your beauty, fashion, skincare, and style assistant
        </p>

        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "20px",
            padding: "20px",
            minHeight: "450px",
            marginBottom: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  backgroundColor:
                    msg.role === "user" ? "#d946ef" : "rgba(255,255,255,0.12)",
                  color: "white",
                  lineHeight: "1.5",
                }}
              >
                <strong>{msg.role === "user" ? "You" : "Glow Up Bot"}:</strong>{" "}
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <p style={{ color: "#ffd6f7", marginTop: "10px" }}>
              Glow Up Bot is thinking...
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Ask for a makeup look, hairstyle, skincare routine, or outfit idea..."
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.2)",
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "white",
              fontSize: "1rem",
              outline: "none",
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              padding: "16px 22px",
              borderRadius: "14px",
              border: "none",
              backgroundColor: "#ff4fd8",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}