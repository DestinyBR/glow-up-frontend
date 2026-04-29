"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_PROFILE = {
  name: "",
  gender_presentation: "",
  style_goals: "",
  skin_concerns: "",
  hair_type_confirmed: "",
  preferred_makeup_style: "",
  fashion_preference: "",
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

const MAX_ANALYSIS_HISTORY = 3;

// Treat these as "no value detected"
const UNCERTAIN_STR = ["uncertain", "not clearly visible", "not detected", ""];
const isUncertain = (v) =>
  !v || UNCERTAIN_STR.includes(String(v).toLowerCase().trim());

// Fields we will auto-fill from selfie analysis whenever the model commits
// to a non-uncertain value. This bypasses the backend's confidence gate so
// that face_shape, hair_texture, etc. always make it into the profile.
const AUTO_FILL_FIELDS = ["face_shape", "hair_texture", "skin_tone", "undertone"];

// ── Photo step definitions ──────────────────────────────────────────────────
const PHOTO_STEPS = [
  {
    step: 1,
    label: "Baseline",
    buttonLabel: "Take Baseline Photo",
    title: "Photo 1: Straight On",
    description: "Face the camera directly. Pull hair away from your jawline and forehead. Neutral expression. No smile.",
    purpose: "Face shape + skin tone baseline",
    icon: "baseline",
    tips: ["Eyes level with camera", "Hair back from face", "Neutral expression", "Even light on both cheeks"],
  },
  {
    step: 2,
    label: "Side Angle",
    buttonLabel: "Take Side Angle Photo",
    title: "Photo 2: Natural Light Angle",
    description: "Turn your head 15–20° to one side. Sit near a window, natural daylight gives the most accurate undertone read.",
    purpose: "Undertone + jaw shape confirmation",
    icon: "angle",
    tips: ["Near a window if possible", "No flash", "Slight turn, not full profile", "Daylight best for undertone"],
  },
  {
    step: 3,
    label: "Hair",
    buttonLabel: "Take Hair Photo",
    title: "Photo 3: Hair Visible",
    description: "Hair down or styled as you normally wear it. Show your full hairline. This is how braids, locs, and twists get correctly identified.",
    purpose: "Hair texture + protective style detection",
    icon: "hair",
    tips: ["Full hairline visible", "Hair styled as normal", "Face still centered", "Don't cover jaw or ears"],
  },
];

// ── Canvas brightness check (no API call) ────────────────────────────────────
function getFrameBrightness(video, canvas) {
  if (!video || !canvas || !video.videoWidth) return null;
  const ctx = canvas.getContext("2d");
  const w = 160, h = 90;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return total / (w * h);
}

function brightnessStatus(lum) {
  if (lum === null || lum === undefined) return null;
  if (lum < 55)  return { label: "Too dark — move to better light",          color: "#f87171", emoji: "🌑" };
  if (lum > 210) return { label: "Too bright — avoid direct light or flash", color: "#facc15", emoji: "☀️" };
  return               { label: "Good lighting ✓",                           color: "#4ade80", emoji: "✓"  };
}

// ── Specific post-analysis nudge builder ─────────────────────────────────────
function buildNudgeMessage(stabilized, nAnalyses) {
  const uncertain = (v) =>
    !v || ["uncertain", "not clearly visible", "not detected"].includes(v?.toLowerCase());
  const nudges = [];

  if (uncertain(stabilized?.face_shape)) {
    nudges.push("📐 Face shape came back uncertain — this usually means your jawline or forehead is covered. For Photo 1, pull your hair fully back and face the camera directly.");
  }
  if (uncertain(stabilized?.skin_tone)) {
    nudges.push("🎨 Skin tone was unclear — bright overhead lights or flash can wash out your complexion. Try Photo 2 near a window in natural daylight.");
  }
  if (uncertain(stabilized?.undertone)) {
    nudges.push("🌡️ Undertone couldn't be determined — this reads best in natural light on your cheek. Try Photo 2 near a window with no flash.");
  }
  if (uncertain(stabilized?.hair_texture)) {
    nudges.push("💇 Hair texture was unclear — make sure your full hairline is visible and hair isn't bundled up or off-frame. Photo 3 is specifically for hair detection.");
  }

  if (!nudges.length) return null;

  const header = nAnalyses < MAX_ANALYSIS_HISTORY
    ? "\n\n💡 Tips to improve accuracy on your next photo:"
    : "\n\n💡 Some features are still uncertain. Reset and retake with these tips:";
  return header + "\n" + nudges.join("\n");
}

// ── SVG Pose Illustrations ────────────────────────────────────────────────────
function PoseIllustration({ icon }) {
  if (icon === "baseline") return (
    <svg viewBox="0 0 80 80" width="72" height="72">
      <ellipse cx="40" cy="28" rx="16" ry="19" fill="rgba(255,114,223,0.15)" stroke="#ff72df" strokeWidth="1.5"/>
      <rect x="35" y="45" width="10" height="8" rx="3" fill="rgba(255,114,223,0.1)" stroke="#ff72df" strokeWidth="1.2"/>
      <path d="M18 68 Q40 58 62 68" fill="rgba(255,114,223,0.08)" stroke="#ff72df" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="33" cy="26" r="2.5" fill="#ff72df" opacity="0.8"/>
      <circle cx="47" cy="26" r="2.5" fill="#ff72df" opacity="0.8"/>
      <path d="M40 30 L38 35 L42 35" fill="none" stroke="#ff72df" strokeWidth="1" opacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="40" cy="28" r="22" fill="none" stroke="rgba(255,114,223,0.25)" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="40" y1="4"  x2="40" y2="10" stroke="#ff72df" strokeWidth="1.5" opacity="0.45"/>
      <line x1="40" y1="46" x2="40" y2="52" stroke="#ff72df" strokeWidth="1.5" opacity="0.45"/>
      <line x1="16" y1="28" x2="22" y2="28" stroke="#ff72df" strokeWidth="1.5" opacity="0.45"/>
      <line x1="58" y1="28" x2="64" y2="28" stroke="#ff72df" strokeWidth="1.5" opacity="0.45"/>
    </svg>
  );

  if (icon === "angle") return (
    <svg viewBox="0 0 80 80" width="72" height="72">
      <ellipse cx="42" cy="28" rx="14" ry="19" fill="rgba(255,114,223,0.15)" stroke="#ff72df" strokeWidth="1.5" transform="rotate(-12 42 28)"/>
      <rect x="37" y="45" width="9" height="8" rx="3" fill="rgba(255,114,223,0.1)" stroke="#ff72df" strokeWidth="1.2" transform="rotate(-5 41 49)"/>
      <path d="M16 68 Q40 60 62 66" fill="rgba(255,114,223,0.08)" stroke="#ff72df" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="36" cy="26" r="2.5" fill="#ff72df" opacity="0.8"/>
      <circle cx="46" cy="24" r="2"   fill="#ff72df" opacity="0.35"/>
      <line x1="5"  y1="12" x2="5"  y2="68" stroke="rgba(255,220,100,0.65)" strokeWidth="2"   strokeLinecap="round"/>
      <line x1="11" y1="8"  x2="11" y2="72" stroke="rgba(255,220,100,0.4)"  strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17" y1="10" x2="17" y2="70" stroke="rgba(255,220,100,0.2)"  strokeWidth="1"   strokeLinecap="round"/>
      <path d="M62 30 Q70 28 68 22" fill="none" stroke="#ff72df" strokeWidth="1.5" strokeLinecap="round"/>
      <polygon points="66,19 71,22 68,26" fill="#ff72df" opacity="0.65"/>
    </svg>
  );

  if (icon === "hair") return (
    <svg viewBox="0 0 80 80" width="72" height="72">
      <ellipse cx="40" cy="30" rx="16" ry="18" fill="rgba(255,114,223,0.15)" stroke="#ff72df" strokeWidth="1.5"/>
      <path d="M24 22 Q18 10 26 6 Q34 2 40 8"   fill="none" stroke="#ff72df" strokeWidth="2"   strokeLinecap="round" opacity="0.9"/>
      <path d="M28 18 Q22 6  32 4 Q40 2 42 10"  fill="none" stroke="#ff72df" strokeWidth="1.8" strokeLinecap="round" opacity="0.65"/>
      <path d="M56 22 Q62 10 54 6 Q46 2 40 8"   fill="none" stroke="#ff72df" strokeWidth="2"   strokeLinecap="round" opacity="0.9"/>
      <path d="M52 18 Q58 6  48 4 Q40 2 38 10"  fill="none" stroke="#ff72df" strokeWidth="1.8" strokeLinecap="round" opacity="0.65"/>
      <path d="M24 24 Q16 40 20 58"             fill="none" stroke="#ff72df" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
      <path d="M56 24 Q64 40 60 58"             fill="none" stroke="#ff72df" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
      <rect x="35" y="46" width="10" height="8" rx="3" fill="rgba(255,114,223,0.1)" stroke="#ff72df" strokeWidth="1.2"/>
      <circle cx="34" cy="28" r="2.5" fill="#ff72df" opacity="0.8"/>
      <circle cx="46" cy="28" r="2.5" fill="#ff72df" opacity="0.8"/>
      <line x1="40" y1="10" x2="40" y2="15" stroke="rgba(255,200,100,0.8)" strokeWidth="2" strokeLinecap="round"/>
      <text x="40" y="76" textAnchor="middle" fontSize="7" fill="rgba(255,114,223,0.6)" fontFamily="sans-serif">hairline visible</text>
    </svg>
  );

  return null;
}

// ── Field component ───────────────────────────────────────────────────────────
// data-profile-field lets the voice handler know which field is currently
// focused so dictation can write into the right slot of profile state.
function Field({ label, field, placeholder, profile, setProfile }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type="text"
        data-profile-field={field}
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
    lower.includes("generate an image") || lower.includes("generate images") ||
    lower.includes("create an image")   || lower.includes("create pictures")  ||
    lower.includes("create images")     || lower.includes("give pictures")    ||
    lower.includes("make an image")     || lower.includes("show me an image") ||
    lower.includes("visualize")         || lower.includes("inspo image")      ||
    lower.includes("outfit image")      || lower.includes("hairstyle image")  ||
    lower.includes("makeup look image")
  );
}

function ConfidenceBadge({ score }) {
  if (score === undefined || score === null) return null;
  const [label, color] =
    score >= 0.75 ? ["High Confidence",   "#4ade80"] :
    score >= 0.5  ? ["Medium Confidence", "#facc15"] :
                    ["Low Confidence",    "#f87171"];
  return (
    <span style={{
      display:"inline-block", padding:"2px 10px", borderRadius:999,
      background:`${color}22`, border:`1px solid ${color}88`,
      color, fontSize:"0.78rem", fontWeight:700, marginLeft:8, verticalAlign:"middle",
    }}>
      {label}
    </span>
  );
}

// ── Mic icon (small inline SVG, no extra deps) ───────────────────────────────
function MicIcon({ active = false }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill={active ? "#fff" : "#fff"}/>
      <path d="M5 11a7 7 0 0 0 14 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="9" y1="22" x2="15" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [message,      setMessage]      = useState("");
  const [chatHistory,  setChatHistory]  = useState([{
    role: "assistant",
    content: "Heyy, I'm Glow Up Bot! Ask me about makeup, hairstyles, skincare, outfit ideas, or beauty inspo images.",
    type: "text",
  }]);
  const [loading,          setLoading]          = useState(false);
  const [profile,          setProfileState]     = useState(DEFAULT_PROFILE);
  const [analysisHistory,  setAnalysisHistory]  = useState([]);
  const [analyzingFace,    setAnalyzingFace]    = useState(false);
  const [cameraOpen,       setCameraOpen]       = useState(false);
  const [cameraError,      setCameraError]      = useState("");
  const [cameraReady,      setCameraReady]      = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [currentPhotoStep, setCurrentPhotoStep] = useState(0);
  const [photosTaken,      setPhotosTaken]      = useState(0);
  const [brightness,       setBrightness]       = useState(null);

  // Voice input state
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [listening,      setListening]      = useState(false);
  const [voiceNotice,    setVoiceNotice]    = useState("");

  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const brightnessCanvas   = useRef(null);
  const streamRef          = useRef(null);
  const composerRef        = useRef(null);
  const inputRef           = useRef(null);
  const brightnessRafRef   = useRef(null);
  const recognitionRef     = useRef(null);
  const lastFocusedRef     = useRef(null);
  const profileRef         = useRef(profile);

  // Keep a live ref to profile so the speech callback can read latest state
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const p = localStorage.getItem("glowup_profile");
      if (p) setProfileState(JSON.parse(p));
      const h = localStorage.getItem("glowup_analysis_history");
      if (h) {
        const parsed = JSON.parse(h);
        if (Array.isArray(parsed)) { setAnalysisHistory(parsed); setPhotosTaken(parsed.length); }
      }
    } catch (_) {}
  }, []);

  const setProfile = (p) => {
    setProfileState(p);
    profileRef.current = p;
    try { localStorage.setItem("glowup_profile", JSON.stringify(p)); } catch (_) {}
  };

  const saveAnalysisHistory = (h) => {
    setAnalysisHistory(h);
    setPhotosTaken(h.length);
    try { localStorage.setItem("glowup_analysis_history", JSON.stringify(h)); } catch (_) {}
  };

  const resetAnalysisHistory = () => { saveAnalysisHistory([]); setCurrentPhotoStep(0); };

  // ── Voice input setup ──────────────────────────────────────────────────
  // Detect browser support for SpeechRecognition (Chrome/Edge have it)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  // Track which input the user last focused so dictation knows where to type
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = (e) => {
      const el = e.target;
      if (!el || !el.matches) return;
      if (
        el.matches('input[type="text"]') ||
        el.matches("textarea") ||
        el.classList.contains("composer-input") ||
        el.classList.contains("field-input")
      ) {
        lastFocusedRef.current = el;
      }
    };
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);

  function appendToFocused(text) {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const el = lastFocusedRef.current;

    // Composer / no focused field → write to chat input
    if (!el || el === inputRef.current || el.classList?.contains("composer-input")) {
      setMessage((prev) => (prev ? prev + " " : "") + trimmed);
      inputRef.current?.focus();
      return;
    }

    // Profile field → update React state for that field
    const field = el.dataset?.profileField;
    if (field && Object.prototype.hasOwnProperty.call(DEFAULT_PROFILE, field)) {
      const cur = profileRef.current || DEFAULT_PROFILE;
      const existing = String(cur[field] ?? "").trim();
      const merged = (existing ? existing + " " : "") + trimmed;
      setProfile({ ...cur, [field]: merged });
      // Re-focus so user can keep typing/dictating into the same field
      requestAnimationFrame(() => el.focus());
      return;
    }

    // Fallback: just send to composer
    setMessage((prev) => (prev ? prev + " " : "") + trimmed);
    inputRef.current?.focus();
  }

  function showVoiceNotice(msg) {
    setVoiceNotice(msg);
    setTimeout(() => setVoiceNotice(""), 4000);
  }

  function toggleVoice() {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showVoiceNotice("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    // Already listening → stop
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      return;
    }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) appendToFocused(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (event) => {
      setListening(false);
      const code = event?.error || "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        showVoiceNotice("Microphone permission was denied. Allow mic access in your browser settings.");
      } else if (code === "no-speech") {
        showVoiceNotice("Didn't catch that — try speaking a bit louder.");
      } else if (code === "audio-capture") {
        showVoiceNotice("No microphone detected on this device.");
      }
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (_) {
      // Some browsers throw if start() is called too quickly after stop()
      setListening(false);
    }
  }

  // Stop any ongoing recognition when the component unmounts
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  // ── Live brightness loop ────────────────────────────────────────────────
  const stopBrightnessLoop = useCallback(() => {
    if (brightnessRafRef.current) { cancelAnimationFrame(brightnessRafRef.current); brightnessRafRef.current = null; }
    setBrightness(null);
  }, []);

  const startBrightnessLoop = useCallback(() => {
    const loop = () => {
      if (videoRef.current && brightnessCanvas.current) {
        setBrightness(getFrameBrightness(videoRef.current, brightnessCanvas.current));
      }
      brightnessRafRef.current = requestAnimationFrame(loop);
    };
    brightnessRafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (cameraReady) startBrightnessLoop();
    else stopBrightnessLoop();
    return stopBrightnessLoop;
  }, [cameraReady, startBrightnessLoop, stopBrightnessLoop]);

  // ── Camera helpers ─────────────────────────────────────────────────────
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    stopBrightnessLoop();
  }

  async function openCameraForStep(step) {
    setCurrentPhotoStep(step);
    setCameraError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try { await videoRef.current.play(); setCameraReady(true); }
          catch { setCameraError("Camera opened, but video could not start."); }
        };
      }
    } catch {
      setCameraError("Unable to access camera. Allow camera permission and use localhost.");
      setCameraOpen(false);
    }
  }

  function closeCamera() { stopCamera(); setCameraOpen(false); setCameraError(""); }

  // ── Analysis ───────────────────────────────────────────────────────────
  async function analyzeBlob(blob) {
  setAnalyzingFace(true);
  setAnalysisComplete(false);
  setAnalysisProgress(10);

  const interval = setInterval(() => {
    setAnalysisProgress((p) => (p >= 88 ? p : p + 8));
  }, 500);

  try {
    const stepDef = PHOTO_STEPS[currentPhotoStep - 1];

    const ctx = stepDef
      ? `This is Photo ${currentPhotoStep}: ${stepDef.purpose}. ${stepDef.description}`
      : "Please estimate face shape, skin tone, undertone, and hair texture/style.";

    const fd = new FormData();
    fd.append("file", blob, "selfie.jpg");
    fd.append("extra_context", ctx);
    fd.append("profile", JSON.stringify(profileRef.current || profile));
    fd.append("analysis_history", JSON.stringify(analysisHistory));
    fd.append("force_update", "false");

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${apiBase}/analyze-face`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Face analysis failed");
    }

    const newHistory = Array.isArray(data.analysis_history)
      ? data.analysis_history
      : analysisHistory;

    saveAnalysisHistory(newHistory);

    const raw = data.analysis || {};
    const display = data.stabilized || raw || {};
    const nAnalyses = newHistory.length || 1;

    const confidenceScore =
      Number(display.confidence_score ?? raw.confidence_score ?? 0);

    const isHighConfidence = confidenceScore >= 0.75;
    const isMediumConfidence = confidenceScore >= 0.5 && confidenceScore < 0.75;
    const needsAnotherScan = confidenceScore < 0.75;

    const currentSavedProfile = profileRef.current || DEFAULT_PROFILE;

    let savedFields = [];

    if (isHighConfidence && data.profile) {
      const nextProfile = { ...currentSavedProfile, ...data.profile };

      for (const field of ["face_shape", "skin_tone", "undertone", "hair_texture"]) {
        const oldValue = String(currentSavedProfile[field] || "").trim();
        const newValue = String(nextProfile[field] || "").trim();

        if (newValue && !isUncertain(newValue) && oldValue !== newValue) {
          savedFields.push(field);
        }
      }

      setProfile(nextProfile);
    }

    const unc = (v) =>
      !v ||
      ["uncertain", "not clearly visible", "not detected"].includes(
        String(v).toLowerCase().trim()
      );

    const fmt = (label, value) => {
      return unc(value) ? `${label}: uncertain` : `${label}: ${value}`;
    };

    const confidenceLabel = isHighConfidence
      ? "High confidence"
      : isMediumConfidence
      ? "Medium confidence"
      : "Low confidence";

    const stabilizationNote =
      nAnalyses < MAX_ANALYSIS_HISTORY
        ? `📸 Photo ${nAnalyses}/${MAX_ANALYSIS_HISTORY} complete — ${
            MAX_ANALYSIS_HISTORY - nAnalyses
          } more photo(s) will improve accuracy.`
        : "✅ All 3 photos analyzed — results are stabilized.";

    const profileNote = isHighConfidence
      ? savedFields.length
        ? `💾 Saved to your profile: ${savedFields
            .map((f) => f.replace("_", " "))
            .join(", ")}.`
        : "💾 High confidence result received. Your saved profile did not need changes."
      : "⚠️ Needs another scan — I did not save this result because confidence was not high enough.";

    const safetyNote = needsAnotherScan
      ? "\n\nWhy not saved: this prevents one unclear photo or a different person from overwriting the saved profile."
      : "";

    const nudge = buildNudgeMessage(display, nAnalyses);

    const reply = `Here's your selfie analysis ✨

${stabilizationNote}
${profileNote}

Confidence: ${confidenceLabel} (${Math.round(confidenceScore * 100)}%)

${fmt("Face shape", display.face_shape)}
${fmt("Skin tone", display.skin_tone)}
${fmt("Undertone", display.undertone)}
${fmt("Hair texture/style", display.hair_texture)}

${display.confidence_note || raw.confidence_note || ""}${safetyNote}

Best hairstyle directions:
${
  Array.isArray(display.hairstyle_directions) &&
  display.hairstyle_directions.length
    ? display.hairstyle_directions.map((i) => `• ${i}`).join("\n")
    : "• No suggestions returned"
}

Suggested makeup look: ${display.makeup_look || raw.makeup_look || "Not provided"}
Blush placement: ${display.blush_placement || raw.blush_placement || "Not provided"}
Contour/Bronzer: ${display.contour_bronzer || raw.contour_bronzer || "Not provided"}

Lip shades:
${
  Array.isArray(display.lip_shades) && display.lip_shades.length
    ? display.lip_shades.map((i) => `• ${i}`).join("\n")
    : "• No lip shades returned"
}${nudge || ""}`.trim();

    setChatHistory((prev) => [
      ...prev,
      {
        role: "assistant",
        content: reply,
        type: "text",
        confidenceScore,
      },
    ]);
  } catch (err) {
    setChatHistory((prev) => [
      ...prev,
      {
        role: "assistant",
        content: err.message || "Something went wrong.",
        type: "text",
      },
    ]);
  } finally {
    clearInterval(interval);
    setAnalysisProgress(100);
    setAnalysisComplete(true);

    setTimeout(() => {
      setAnalyzingFace(false);
      setAnalysisComplete(false);
      setAnalysisProgress(0);
    }, 900);
  }
}

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(async (blob) => {
      if (!blob) return;
      setAnalyzingFace(true);
      await analyzeBlob(blob);
      setAnalyzingFace(false);
      closeCamera();
    }, "image/jpeg", 0.95);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentPhotoStep(Math.min(photosTaken + 1, MAX_ANALYSIS_HISTORY));
    await analyzeBlob(file);
    e.target.value = "";
  }

  async function generateImageFromPrompt(prompt) {
    const res  = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") + "/analyze-face", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Image generation failed");
    return data.image_base64;
  }

  function sendQuick(text) {
    setMessage(text);
    setTimeout(() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); inputRef.current?.focus(); }, 100);
  }

  async function sendMessage(quickText = null) {
    const msg = quickText || message;
    if (!msg.trim()) return;
    const history = [...chatHistory, { role: "user", content: msg, type: "text" }];
    setChatHistory(history); setLoading(true); setMessage("");
    try {
      const res  = await fetch(process.env.NEXT_PUBLIC_API_URL + "/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, messages: history, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Chat request failed");
      if (data.profile) setProfile(data.profile);
      const newMsgs = [...history, { role: "assistant", content: data.reply || "No response.", type: "text" }];
      if (isImageRequest(msg)) {
        const b64 = await generateImageFromPrompt(msg);
        newMsgs.push({ role: "assistant", content: "I made a beauty inspo image based on your request!", type: "image", imageSrc: `data:image/png;base64,${b64}` });
      }
      setChatHistory(newMsgs);
    } catch (err) {
      setChatHistory([...history, { role: "assistant", content: err.message || "Something went wrong.", type: "text" }]);
    } finally { setLoading(false); }
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const brightnessInfo = brightnessStatus(brightness);
  const allDone        = photosTaken >= MAX_ANALYSIS_HISTORY;
  const nextStepDef    = PHOTO_STEPS[Math.min(photosTaken, MAX_ANALYSIS_HISTORY - 1)];
  const activeStepDef  = PHOTO_STEPS[currentPhotoStep - 1];

  const progressLabel = photosTaken === 0
    ? "No photos yet"
    : allDone
    ? "✅ All 3 photos complete"
    : `📸 ${photosTaken}/${MAX_ANALYSIS_HISTORY} photos`;

  // Helpful hint above the mic button so user knows what it'll dictate into
  const focusedFieldHint = (() => {
    const el = lastFocusedRef.current;
    if (!el) return "chat";
    const f = el.dataset?.profileField;
    if (f) return f.replace("_", " ");
    return "chat";
  })();

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="page-shell">
      <div className="bg-orb orb-1"/>
      <div className="bg-orb orb-2"/>
      <canvas ref={brightnessCanvas} style={{ display:"none" }}/>

      <div className="app-wrap">
        {/* Hero */}
        <header className="hero-card hero-modern">
          <div className="hero-left">
            <p className="eyebrow">AI Beauty Assistant</p>
            <h1 className="hero-title">Glow Up Bot</h1>
            <p className="hero-subtitle">Personalized beauty, hair, skincare, and style guidance powered by your profile.</p>
          </div>
          <div className="hero-right">
            <p className="hero-action-title">Start with a category</p>
            <div className="hero-actions">
              <button onClick={() => sendQuick("Give me the best hairstyles for my face shape and hair texture")}>Best Hairstyles</button>
              <button onClick={() => sendQuick("What colors look best on me based on my skin tone and undertone")}>Best Colors</button>
              <button onClick={() => sendQuick("Suggest a makeup look for my face shape, skin tone, and undertone")}>Makeup Match</button>
              <button onClick={() => sendQuick("Recommend culturally relevant beauty and hair products for my skin tone and hair type")}>Product Suggestions</button>
            </div>
          </div>
        </header>

        <div className="feature-bar"/>

        <div className="workspace-grid">

          {/* ── Sidebar ── */}
          <aside className="profile-sidebar">
            <section className="panel-card profile-card">
              <h2 className="panel-title">Your Beauty Profile</h2>
              <p className="panel-copy">Fill this in so I can give you more personalized advice. </p>

              <div className="profile-grid">
                <Field label="Your Name" field="name" placeholder="e.g. Destiny" profile={profile} setProfile={setProfile}/>

                <Field label="Gender / Presentation Preference" field="gender_presentation" placeholder="e.g. feminine, masculine, androgynous, soft glam" profile={profile} setProfile={setProfile}/>

                <Field label="Style Goals" field="style_goals" placeholder="e.g. polished, soft, confident, professional" profile={profile} setProfile={setProfile}/>

                <Field label="Skin Concerns" field="skin_concerns" placeholder="e.g. hyperpigmentation, acne, dryness, texture" profile={profile} setProfile={setProfile}/>

                <Field label="Hair Type Confirmation" field="hair_type_confirmed" placeholder="e.g. I currently have braids, locs, wig, 4c coils" profile={profile} setProfile={setProfile}/>

                <Field label="Preferred Makeup Style" field="preferred_makeup_style" placeholder="e.g. natural, soft glam, full glam, no makeup look" profile={profile} setProfile={setProfile}/>

                <Field label="Fashion Preference" field="fashion_preference" placeholder="e.g. modest, bold, natural, classy, streetwear" profile={profile} setProfile={setProfile}/>

                <Field label="Skin Tone" field="skin_tone" placeholder="e.g. light, medium, deep brown" profile={profile} setProfile={setProfile}/>

                <Field label="Undertone" field="undertone" placeholder="e.g. warm, cool, neutral" profile={profile} setProfile={setProfile}/>

                <Field label="Face Shape" field="face_shape" placeholder="e.g. oval, round, square" profile={profile} setProfile={setProfile}/>

                <Field label="Hair Texture" field="hair_texture" placeholder="AI estimate: braids, locs, coils, wavy" profile={profile} setProfile={setProfile}/>

                <Field label="Budget" field="budget" placeholder="e.g. drugstore, mid-range" profile={profile} setProfile={setProfile}/>
              </div>

              {/* ── Photo progress ── */}
              <div style={{ marginTop:18, padding:"12px 14px", borderRadius:16, background:"rgba(255,255,255,0.055)", border:"1px solid rgba(255,255,255,0.1)" }}>
                <p style={{ margin:"0 0 10px", fontSize:"0.85rem", color:"#f2dfff", fontWeight:700 }}>{progressLabel}</p>

                {/* Progress bar dots */}
                <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                  {PHOTO_STEPS.map((s) => {
                    const done   = photosTaken >= s.step;
                    const active = !done && photosTaken === s.step - 1;
                    return (
                      <div key={s.step} style={{
                        flex:1, height:6, borderRadius:999,
                        background: done   ? "linear-gradient(135deg,#ff4fd8,#d946ef)"
                                  : active ? "rgba(255,114,223,0.38)"
                                  :          "rgba(255,255,255,0.09)",
                        transition:"background 0.3s ease",
                      }}/>
                    );
                  })}
                </div>

                {/* Step labels */}
                <div style={{ display:"flex", gap:6 }}>
                  {PHOTO_STEPS.map((s) => (
                    <div key={s.step} style={{
                      flex:1, fontSize:"0.68rem", textAlign:"center", lineHeight:1.3,
                      color: photosTaken >= s.step ? "#ff72df" : "rgba(255,255,255,0.3)",
                    }}>
                      {photosTaken >= s.step ? "✓ " : ""}{s.label}
                    </div>
                  ))}
                </div>

                {photosTaken > 0 && (
                  <button onClick={resetAnalysisHistory} style={{
                    marginTop:10, background:"transparent",
                    border:"1px solid rgba(255,255,255,0.16)", color:"rgba(255,255,255,0.55)",
                    borderRadius:10, padding:"5px 12px", cursor:"pointer", fontSize:"0.74rem",
                  }}>
                    Reset — new face
                  </button>
                )}
              </div>

              {/* ── Wizard: next step card + button ── */}
              {!allDone && (
                <div style={{ marginTop:16 }}>
                  <div style={{
                    padding:"14px", borderRadius:18,
                    background:"rgba(255,79,216,0.07)",
                    border:"1px solid rgba(255,114,223,0.22)",
                    marginBottom:12,
                  }}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{ flexShrink:0, opacity:0.95 }}>
                        <PoseIllustration icon={nextStepDef.icon}/>
                      </div>
                      <div>
                        <p style={{ margin:"0 0 3px", fontWeight:800, fontSize:"0.88rem", color:"#ff72df" }}>
                          {nextStepDef.title}
                        </p>
                        <p style={{ margin:"0 0 8px", fontSize:"0.78rem", color:"#dbc0ee", lineHeight:1.45 }}>
                          {nextStepDef.description}
                        </p>
                        <ul style={{ margin:0, padding:0, listStyle:"none" }}>
                          {nextStepDef.tips.map((tip, i) => (
                            <li key={i} style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.42)", marginBottom:2 }}>· {tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="camera-actions">
                    <button
                      onClick={() => openCameraForStep(photosTaken + 1)}
                      className="primary-btn"
                      disabled={analyzingFace}
                      style={{ flex:1 }}
                    >
                      {analyzingFace ? "Analyzing..." : nextStepDef.buttonLabel}
                    </button>
                    <label className="secondary-btn" style={{ cursor:"pointer" }}>
                      Upload
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display:"none" }}/>
                    </label>
                  </div>
                </div>
              )}

              {allDone && (
                <div style={{ marginTop:16 }}>
                  <div style={{
                    padding:"12px 14px", borderRadius:14, marginBottom:12,
                    background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.22)",
                    color:"#4ade80", fontSize:"0.85rem", fontWeight:600,
                  }}>
                    ✅ Analysis complete! Your profile is stabilized across all 3 photos.
                  </div>
                  <button onClick={() => { resetAnalysisHistory(); openCameraForStep(1); }} className="ghost-btn">
                    Retake All Photos
                  </button>
                </div>
              )}

              <p className="micro-copy" style={{ marginTop:14 }}>
                <strong style={{ color:"#ff72df" }}>3 photos = best accuracy.</strong> Each photo targets a different feature. Natural window light gives the most accurate skin tone and undertone read — especially for deeper complexions.
              </p>
            </section>
          </aside>

          {/* ── Chat workspace ── */}
          <section className="chat-workspace">
            <section className="chat-card">
              <div className="chat-scroll">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={msg.role === "user" ? "message-row user-row" : "message-row bot-row"}>
                    <div className={msg.role === "user" ? "message-bubble user-bubble" : "message-bubble bot-bubble"}>
                      {msg.type !== "image" && (
                        <>
                          <strong>
                            {msg.role === "user" ? "You" : "Glow Up Bot"}
                            {msg.confidenceScore !== undefined && <ConfidenceBadge score={msg.confidenceScore}/>}:
                          </strong>{" "}
                          <span>{msg.content}</span>
                        </>
                      )}
                      {msg.type === "image" && (
                        <div className="image-message">
                          <strong>Glow Up Bot:</strong>
                          <p className="image-message-copy">{msg.content}</p>
                          <img src={msg.imageSrc} alt="Generated beauty inspiration" className="generated-image"/>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(loading || analyzingFace) && (
                  <div className="typing-indicator">
                    <span>Alright I gotchu! Let me think</span>
                    <div className="typing-dots"><i/><i/><i/></div>
                  </div>
                )}
              </div>
            </section>

            {/* Voice notice (errors / unsupported) */}
            {voiceNotice && (
              <div className="voice-notice">{voiceNotice}</div>
            )}

            {/* Listening hint */}
            {listening && (
              <div className="voice-listening-hint">
                🎙️ Listening… speak now (will type into <strong>{focusedFieldHint}</strong>)
              </div>
            )}

            <section className="composer-card" ref={composerRef}>
              <input
                ref={inputRef} type="text" value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Ask for makeup looks, hairstyles, outfit ideas, skincare, or generate an inspo image..."
                className="composer-input"
              />

              {/* Mic button — dictates into whatever field is focused */}
              <button
                type="button"
                onClick={toggleVoice}
                className={`mic-btn ${listening ? "mic-btn-listening" : ""}`}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                title={
                  !voiceSupported
                    ? "Voice input not supported in this browser"
                    : listening
                    ? "Stop dictating"
                    : "Tap to dictate into the focused field"
                }
                disabled={!voiceSupported}
              >
                <MicIcon active={listening}/>
              </button>

              <button onClick={() => sendMessage()} disabled={loading} className="primary-btn composer-send">Send</button>
            </section>
          </section>
        </div>
      </div>

      {/* ── Camera Modal ── */}
      {cameraOpen && (
        <div className="camera-modal">
          <div className="camera-panel">
            <div className="camera-top">
              <div>
                <h3 className="camera-title">
                  {activeStepDef?.title || "Live Camera Analysis"}
                  {activeStepDef && (
                    <span style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.5)", fontWeight:400, marginLeft:10 }}>
                      Step {activeStepDef.step} of {MAX_ANALYSIS_HISTORY}
                    </span>
                  )}
                </h3>
                <p className="camera-copy">
                  {activeStepDef?.description || "Center your face in the frame, then take a photo."}
                </p>
              </div>
              <button onClick={closeCamera} className="icon-close-btn">✕</button>
            </div>

            {/* Step tip pills */}
            {activeStepDef && (
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12 }}>
                {activeStepDef.tips.map((tip, i) => (
                  <span key={i} style={{
                    padding:"4px 10px", borderRadius:999,
                    background:"rgba(255,114,223,0.09)",
                    border:"1px solid rgba(255,114,223,0.18)",
                    color:"#f2dfff", fontSize:"0.74rem",
                  }}>
                    {tip}
                  </span>
                ))}
              </div>
            )}

            {cameraError && <p className="camera-error">{cameraError}</p>}

            {/* Live brightness bar */}
            {brightnessInfo && cameraReady && !analyzingFace && (
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"8px 14px", borderRadius:12, marginBottom:10,
                background:`${brightnessInfo.color}12`,
                border:`1px solid ${brightnessInfo.color}44`,
                transition:"all 0.3s ease",
              }}>
                <span style={{ fontSize:"1rem" }}>{brightnessInfo.emoji}</span>
                <span style={{ color:brightnessInfo.color, fontWeight:700, fontSize:"0.84rem" }}>
                  {brightnessInfo.label}
                </span>
              </div>
            )}

            <div className="video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video"/>

              {analyzingFace && (
                <div className="analysis-overlay">
                  <div className="face-detection-box">
                    <span className="corner top-left"/>
                    <span className="corner top-right"/>
                    <span className="corner bottom-left"/>
                    <span className="corner bottom-right"/>
                  </div>
                  <div className="analysis-box">
                    <p className="analysis-title">
                      {analysisComplete ? "Analysis complete ✓" : `Analyzing photo ${currentPhotoStep}...`}
                    </p>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${analysisProgress}%` }}/>
                    </div>
                    <p className="analysis-percent">{analysisProgress}%</p>
                  </div>
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="video-overlay">Starting camera...</div>
              )}
            </div>

            <div className="camera-btn-row">
              <button onClick={capturePhoto} className="primary-btn" disabled={analyzingFace || !cameraReady}>
                {activeStepDef?.buttonLabel || "Take Photo & Analyze"}
              </button>
              <button onClick={closeCamera} className="ghost-btn">Cancel</button>
            </div>

            <canvas ref={canvasRef} style={{ display:"none" }}/>
          </div>
        </div>
      )}
    </main>
  );
}