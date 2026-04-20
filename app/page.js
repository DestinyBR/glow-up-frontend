// "use client";

// import { useState } from "react";

// export default function Home() {
//   const [message, setMessage] = useState("");
//   const [chatHistory, setChatHistory] = useState([
//     {
//       role: "assistant",
//       content:
//         "Heyy, I’m Glow Up Bot 💄 Ask me about makeup, hairstyles, skincare, or outfit ideas.",
//     },
//   ]);
//   const [loading, setLoading] = useState(false);

// async function sendMessage() {
//   if (!message.trim()) return;

//   const updatedHistory = [...chatHistory, { role: "user", content: message }];
//   setChatHistory(updatedHistory);
//   setLoading(true);

//   try {
//     const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/chat", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         message: message,
//         messages: updatedHistory,
//         profile: {},
//       }),
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.detail || "Request failed");a
//     }

//     setChatHistory([
//       ...updatedHistory,
//       {
//         role: "assistant",
//         content: data.reply || "No response came back from the bot.",
//       },
//     ]);

//     setMessage("");
//   } catch (error) {
//     console.error("FRONTEND CHAT ERROR:", error);

//     setChatHistory([
//       ...updatedHistory,
//       {
//         role: "assistant",
//         content: error.message || "Something went wrong connecting to the backend.",
//       },
//     ]);
//   } finally {
//     setLoading(false);
//   }
// }

//   return (
//     <main
//       style={{
//         minHeight: "100vh",
//         background: "linear-gradient(to bottom, #1a1a1a, #2d0b45)",
//         color: "white",
//         padding: "40px 20px",
//         fontFamily: "Arial, sans-serif",
//       }}
//     >
//       <div
//         style={{
//           maxWidth: "900px",
//           margin: "0 auto",
//         }}
//       >
//         <h1
//           style={{
//             fontSize: "3rem",
//             fontWeight: "bold",
//             marginBottom: "10px",
//             textAlign: "center",
//           }}
//         >
//           Glow Up Bot 💄
//         </h1>

//         <p
//           style={{
//             textAlign: "center",
//             color: "#f3d9ff",
//             marginBottom: "30px",
//             fontSize: "1.1rem",
//           }}
//         >
//           Your beauty, fashion, skincare, and style assistant
//         </p>

//         <div
//           style={{
//             backgroundColor: "rgba(255,255,255,0.08)",
//             border: "1px solid rgba(255,255,255,0.15)",
//             borderRadius: "20px",
//             padding: "20px",
//             minHeight: "450px",
//             marginBottom: "20px",
//             boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
//           }}
//         >
//           {chatHistory.map((msg, index) => (
//             <div
//               key={index}
//               style={{
//                 display: "flex",
//                 justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
//                 marginBottom: "16px",
//               }}
//             >
//               <div
//                 style={{
//                   maxWidth: "75%",
//                   padding: "12px 16px",
//                   borderRadius: "16px",
//                   backgroundColor:
//                     msg.role === "user" ? "#d946ef" : "rgba(255,255,255,0.12)",
//                   color: "white",
//                   lineHeight: "1.5",
//                 }}
//               >
//                 <strong>{msg.role === "user" ? "You" : "Glow Up Bot"}:</strong>{" "}
//                 {msg.content}
//               </div>
//             </div>
//           ))}

//           {loading && (
//             <p style={{ color: "#ffd6f7", marginTop: "10px" }}>
//               Glow Up Bot is thinking...
//             </p>
//           )}
//         </div>

//         <div
//           style={{
//             display: "flex",
//             gap: "12px",
//           }}
//         >
//           <input
//             type="text"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             onKeyDown={(e) => {
//               if (e.key === "Enter") sendMessage();
//             }}
//             placeholder="Ask for a makeup look, hairstyle, skincare routine, or outfit idea..."
//             style={{
//               flex: 1,
//               padding: "16px",
//               borderRadius: "14px",
//               border: "1px solid rgba(255,255,255,0.2)",
//               backgroundColor: "rgba(255,255,255,0.08)",
//               color: "white",
//               fontSize: "1rem",
//               outline: "none",
//             }}
//           />

//           <button
//             onClick={sendMessage}
//             disabled={loading}
//             style={{
//               padding: "16px 22px",
//               borderRadius: "14px",
//               border: "none",
//               backgroundColor: "#ff4fd8",
//               color: "white",
//               fontWeight: "bold",
//               cursor: "pointer",
//               fontSize: "1rem",
//             }}
//           >
//             Send
//           </button>
//         </div>
//       </div>
//     </main>
//   );
// }

"use client";
 
import { useState, useEffect } from "react";
 
// ── Default profile shape ──────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  name: "",
  favorite_colors: [],
  favorite_styles: [],
  best_colors: [],
  skin_tone: "",
  undertone: "",
  face_shape: "",
  hair_texture: "",
  budget: "",
  notes: [],
};
 
export default function Home() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    {
      role: "assistant",
      content:
        "Heyy, I'm Glow Up Bot 💄 Ask me about makeup, hairstyles, skincare, or outfit ideas.",
    },
  ]);
  const [loading, setLoading] = useState(false);
 
  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfileState] = useState(DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
 
  // Load profile from localStorage on first render
  useEffect(() => {
    const saved = localStorage.getItem("glowup_profile");
    if (saved) {
      try {
        setProfileState(JSON.parse(saved));
      } catch (_) {}
    }
  }, []);
 
  // Save profile to localStorage whenever it changes
  const setProfile = (newProfile) => {
    setProfileState(newProfile);
    localStorage.setItem("glowup_profile", JSON.stringify(newProfile));
  };
 
  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!message.trim()) return;
 
    const updatedHistory = [...chatHistory, { role: "user", content: message }];
    setChatHistory(updatedHistory);
    setLoading(true);
 
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          messages: updatedHistory,
          profile: profile,         // ← send saved profile every time
        }),
      });
 
      const data = await response.json();
 
      if (!response.ok) throw new Error(data.detail || "Request failed");
 
      // Save the updated profile the backend returns
      if (data.profile) setProfile(data.profile);
 
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content: data.reply || "No response came back from the bot.",
        },
      ]);
 
      setMessage("");
    } catch (error) {
      console.error("FRONTEND CHAT ERROR:", error);
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content:
            error.message || "Something went wrong connecting to the backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }
 
  // ── Profile form field helper ──────────────────────────────────────────────
  const Field = ({ label, field, placeholder }) => (
    <div style={{ marginBottom: "10px" }}>
      <label style={{ fontSize: "0.8rem", color: "#f3d9ff", display: "block", marginBottom: "4px" }}>
        {label}
      </label>
      <input
        type="text"
        value={profile[field] || ""}
        placeholder={placeholder}
        onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.2)",
          backgroundColor: "rgba(255,255,255,0.08)",
          color: "white",
          fontSize: "0.9rem",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
 
  // ── Render ─────────────────────────────────────────────────────────────────
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
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
 
        {/* Header */}
        <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "10px", textAlign: "center" }}>
          Glow Up Bot 💄
        </h1>
        <p style={{ textAlign: "center", color: "#f3d9ff", marginBottom: "20px", fontSize: "1.1rem" }}>
          Your beauty, fashion, skincare, and style assistant
        </p>
 
        {/* Profile toggle button */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            style={{
              padding: "10px 22px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.25)",
              backgroundColor: showProfile ? "#ff4fd8" : "rgba(255,255,255,0.1)",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.95rem",
            }}
          >
            {showProfile ? "Hide Profile ▲" : "My Profile ✨"}
          </button>
        </div>
 
        {/* Profile panel */}
        {showProfile && (
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "20px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "#ff4fd8" }}>
              Your Beauty Profile
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#c9a0dc", marginBottom: "16px" }}>
              Fill this in so Glow Up Bot gives you the most personalized advice. It saves automatically.
            </p>
 
            <Field label="Your Name" field="name" placeholder="e.g. Maya" />
            <Field label="Skin Tone" field="skin_tone" placeholder="e.g. light, medium, deep" />
            <Field label="Undertone" field="undertone" placeholder="e.g. warm, cool, neutral" />
            <Field label="Face Shape" field="face_shape" placeholder="e.g. oval, round, square" />
            <Field label="Hair Texture" field="hair_texture" placeholder="e.g. 4c coils, fine straight, wavy" />
            <Field label="Budget" field="budget" placeholder="e.g. drugstore, mid-range, luxury" />
          </div>
        )}
 
        {/* Chat window */}
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
 
        {/* Input row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
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
 