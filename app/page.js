"use client";

import { useState, useEffect, useRef } from "react";

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

function Field({ label, field, placeholder, profile, setProfile }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type="text"
        value={profile[field] || ""}
        placeholder={placeholder}
        onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
      />
    </div>
  );
}

function isImageRequest(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes("generate an image") ||
    lower.includes("generate images") ||
    lower.includes("create an image") ||
    lower.includes("create pictures") ||
    lower.includes("create images") ||
    lower.includes("give pictures") ||
    lower.includes("make an image") ||
    lower.includes("show me an image") ||
    lower.includes("visualize") ||
    lower.includes("inspo image") ||
    lower.includes("outfit image") ||
    lower.includes("hairstyle image") ||
    lower.includes("makeup look image")
  );
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    {
      role: "assistant",
      content:
        "Heyy, I'm Glow Up Bot! Ask me about makeup, hairstyles, skincare, outfit ideas, or beauty inspo images.",
      type: "text",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [profile, setProfileState] = useState(DEFAULT_PROFILE);

  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const composerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("glowup_profile");
    if (saved) {
      try {
        setProfileState(JSON.parse(saved));
      } catch (_) {}
    }
  }, []);

  const setProfile = (newProfile) => {
    setProfileState(newProfile);
    localStorage.setItem("glowup_profile", JSON.stringify(newProfile));
  };

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }

  async function openCamera() {
    try {
      setCameraError("");
      setCameraOpen(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            setCameraReady(true);
          } catch (err) {
            console.error("VIDEO PLAY ERROR:", err);
            setCameraError("Camera opened, but video could not start.");
          }
        };
      }
    } catch (err) {
      console.error("CAMERA ERROR:", err);
      setCameraError(
        "Unable to access camera. Make sure you allow camera permission and are using localhost."
      );
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    stopCamera();
    setCameraOpen(false);
    setCameraError("");
  }

  async function analyzeBlob(blob) {
    setAnalyzingFace(true);

    try {
      const formData = new FormData();
      formData.append("file", blob, "selfie.jpg");
      formData.append(
        "extra_context",
        "Please estimate face shape, skin tone, undertone, and suggest flattering hairstyles."
      );
      formData.append(
        "profile",
        JSON.stringify({
          ...profile,
          skin_tone: "",
          undertone: "",
          face_shape: "",
          hair_texture: "",
        })
      );

      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/analyze-face",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Face analysis failed");

      if (data.profile) setProfile(data.profile);

      const analysis = data.analysis || {};

      const prettyReply = `
Here’s your selfie analysis ✨

Estimated face shape: ${analysis.face_shape || "Not detected"}
Estimated skin tone: ${analysis.skin_tone || "Not detected"}
Estimated undertone: ${analysis.undertone || "Not detected"}
Estimated hair texture/style: ${analysis.hair_texture || "Not detected"}

Confidence note: ${analysis.confidence_note || "No confidence note provided."}

Best hairstyle directions:
${
  Array.isArray(analysis.hairstyle_directions) &&
  analysis.hairstyle_directions.length
    ? analysis.hairstyle_directions.map((item) => `• ${item}`).join("\n")
    : "• No hairstyle suggestions returned"
}

Suggested makeup look: ${analysis.makeup_look || "No makeup look returned"}
Blush placement: ${analysis.blush_placement || "Not provided"}
Contour/Bronzer: ${analysis.contour_bronzer || "Not provided"}

Lip shades:
${
  Array.isArray(analysis.lip_shades) && analysis.lip_shades.length
    ? analysis.lip_shades.map((item) => `• ${item}`).join("\n")
    : "• No lip shades returned"
}
      `.trim();

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: prettyReply,
          type: "text",
        },
      ]);
    } catch (error) {
      console.error("FACE ANALYSIS ERROR:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error.message || "Something went wrong analyzing your selfie.",
          type: "text",
        },
      ]);
    } finally {
      setAnalyzingFace(false);
    }
  }

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
  async (blob) => {
    if (!blob) return;

    setAnalyzingFace(true); // START LOADING

    await analyzeBlob(blob);

    setAnalyzingFace(false); // STOP LOADING
    closeCamera();
  },
      "image/jpeg",
      0.95
    );
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await analyzeBlob(file);
    event.target.value = "";
  }

  async function generateImageFromPrompt(userPrompt) {
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/generate-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userPrompt }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Image generation failed");

      return data.image_base64;
    } catch (error) {
      console.error("IMAGE GENERATION ERROR:", error);
      throw error;
    }
  }

  function sendQuick(text) {
    setMessage(text);

    setTimeout(() => {
      composerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      inputRef.current?.focus();
    }, 100);
  }

  async function sendMessage(quickText = null) {
    const finalMessage = quickText || message;

    if (!finalMessage.trim()) return;

    const userMessage = finalMessage;
    const updatedHistory = [
      ...chatHistory,
      { role: "user", content: userMessage, type: "text" },
    ];

    setChatHistory(updatedHistory);
    setLoading(true);
    setMessage("");

    try {
      const chatResponse = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            messages: updatedHistory,
            profile,
          }),
        }
      );

      const chatData = await chatResponse.json();

      if (!chatResponse.ok) {
        throw new Error(chatData.detail || "Chat request failed");
      }

      if (chatData.profile) setProfile(chatData.profile);

      const newMessages = [
        ...updatedHistory,
        {
          role: "assistant",
          content: chatData.reply || "No response came back from the bot.",
          type: "text",
        },
      ];

      if (isImageRequest(userMessage)) {
        const imageBase64 = await generateImageFromPrompt(userMessage);

        newMessages.push({
          role: "assistant",
          content: "I made a beauty inspo image based on your request!",
          type: "image",
          imageSrc: `data:image/png;base64,${imageBase64}`,
        });
      }

      setChatHistory(newMessages);
    } catch (error) {
      console.error("FRONTEND CHAT ERROR:", error);
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content:
            error.message || "Something went wrong connecting to the backend.",
          type: "text",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <div className="app-wrap">
        <header className="hero-card">
          <div className="hero-top">
            <div>
              <h1 className="hero-title">Glow Up Bot</h1>
              <p className="hero-subtitle">
                Your AI beauty, fashion, skincare, and style assistant.
              </p>

              <div className="feature-bar">
                <button onClick={() => sendQuick("Give me the best hairstyles for my face shape and hair texture")}>
                  Best Hairstyles
                </button>

                <button onClick={() => sendQuick("What colors look best on me based on my skin tone and undertone")}>
                  Best Colors
                </button>

                <button onClick={() => sendQuick("Suggest a makeup look for my face shape, skin tone, and undertone")}>
                  Makeup Match
                </button>

                <button onClick={() => sendQuick("Recommend culturally relevant beauty and hair products for my skin tone and hair type")}>
                  Product Suggestions
                </button>
              </div>
            </div>
          </div>
        </header>
          <div className="feature-bar">
            ...buttons here...
          </div>

        <div className="workspace-grid">
          <aside className="profile-sidebar">
            <section className="panel-card profile-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Your Beauty Profile</h2>
                  <p className="panel-copy">
                    Fill this in so Glow Up Bot gives you more personalized
                    advice. It saves automatically in your browser.
                  </p>
                </div>
              </div>

              <div className="profile-grid">
                <Field
                  label="Your Name"
                  field="name"
                  placeholder="e.g. Destiny"
                  profile={profile}
                  setProfile={setProfile}
                />
                <Field
                  label="Skin Tone"
                  field="skin_tone"
                  placeholder="e.g. light, medium, deep brown"
                  profile={profile}
                  setProfile={setProfile}
                />
                <Field
                  label="Undertone"
                  field="undertone"
                  placeholder="e.g. warm, cool, neutral"
                  profile={profile}
                  setProfile={setProfile}
                />
                <Field
                  label="Face Shape"
                  field="face_shape"
                  placeholder="e.g. oval, round, square"
                  profile={profile}
                  setProfile={setProfile}
                />
                <Field
                  label="Hair Texture"
                  field="hair_texture"
                  placeholder="e.g. 4c coils, fine straight, wavy"
                  profile={profile}
                  setProfile={setProfile}
                />
                <Field
                  label="Budget"
                  field="budget"
                  placeholder="e.g. drugstore, mid-range, luxury"
                  profile={profile}
                  setProfile={setProfile}
                />
              </div>

              <div className="camera-actions">
                <button
                  onClick={openCamera}
                  className="primary-btn"
                  disabled={analyzingFace}
                >
                  {analyzingFace ? "Analyzing..." : "Open Camera"}
                </button>

                <label className="secondary-btn">
                  Upload Selfie
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <p className="micro-copy">
                Use your camera live or upload a selfie so Glow Up Bot can
                estimate face shape, skin tone, undertone, and suggest
                flattering hairstyles.
              </p>
            </section>
          </aside>

          <section className="chat-workspace">
            <section className="chat-card">
              <div className="chat-scroll">
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={
                      msg.role === "user"
                        ? "message-row user-row"
                        : "message-row bot-row"
                    }
                  >
                    <div
                      className={
                        msg.role === "user"
                          ? "message-bubble user-bubble"
                          : "message-bubble bot-bubble"
                      }
                    >
                      {msg.type !== "image" && (
                        <>
                          <strong>
                            {msg.role === "user" ? "You" : "Glow Up Bot"}:
                          </strong>{" "}
                          <span>{msg.content}</span>
                        </>
                      )}

                      {msg.type === "image" && (
                        <div className="image-message">
                          <strong>Glow Up Bot:</strong>
                          <p className="image-message-copy">{msg.content}</p>
                          <img
                            src={msg.imageSrc}
                            alt="Generated beauty inspiration"
                            className="generated-image"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {(loading || analyzingFace) && (
                  <div className="thinking-pill">
                    Alright I gotchu! Let me think...
                  </div>
                )}
              </div>
            </section>

            <section className="composer-card" ref={composerRef}>
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Ask for makeup looks, hairstyles, outfit ideas, skincare, or generate an inspo image..."
                className="composer-input"
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading}
                className="primary-btn composer-send"
              >
                Send
              </button>
            </section>
          </section>
        </div>
      </div>

      {cameraOpen && (
        <div className="camera-modal">
          <div className="camera-panel">
            <div className="camera-top">
              <div>
                <h3 className="camera-title">Live Camera Analysis</h3>
                <p className="camera-copy">
                  Center your face in the frame, then take a photo.
                </p>
              </div>

              <button onClick={closeCamera} className="icon-close-btn">
                ✕
              </button>
            </div>

            {cameraError && <p className="camera-error">{cameraError}</p>}

            <div className="video-wrap">
              <video
              
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"/>
                
                {analyzingFace && (
                  <div className="analysis-overlay">
                    <div className="analysis-box">
                      <div className="spinner" />
                      <p>Analyzing your face...</p>
                    </div>
                  </div>
                )}
          
              {!cameraReady && !cameraError && (
                <div className="video-overlay">Starting camera...</div>
              )}
            </div>

            <div className="camera-btn-row">
              <button onClick={capturePhoto} className="primary-btn">
                Take Photo & Analyze
              </button>
              <button onClick={closeCamera} className="ghost-btn">
                Cancel
              </button>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        </div>
      )}
    </main>
  );
}