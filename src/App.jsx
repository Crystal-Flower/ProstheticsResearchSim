import { useState, useEffect, useRef, useCallback } from "react";

// ─── EMG Processing (mirrors EMGProcessor.cs) ───────────────────────────────
function processEMG(rawValue, prevProcessed, smoothingFactor) {
  const rectified = Math.abs(rawValue);
  return prevProcessed + smoothingFactor * (rectified - prevProcessed);
}

// ─── Neural Network (mirrors EMGNeuralNetwork.cs) ────────────────────────────
function predict(input) {
  return Math.min(1, Math.max(0, input));
}

// ─── Noise Generator for realistic EMG simulation ────────────────────────────
function generateEMGNoise(t, activity) {
  const base = activity;
  const noise =
    Math.sin(t * 47.3) * 0.08 +
    Math.sin(t * 123.7) * 0.04 +
    Math.sin(t * 89.1) * 0.06 +
    (Math.random() - 0.5) * 0.12;
  return Math.min(1, Math.max(0, base + noise * activity));
}

// ─── SVG Knee Anatomy ────────────────────────────────────────────────────────
function KneeAnatomySVG({ angle, emgActivity }) {
  const femurAngle = -angle * 0.4;
  const tibiaAngle = angle;
  const muscleStrain = emgActivity;
  const quadColor = `rgba(220, 80, 60, ${0.3 + muscleStrain * 0.6})`;
  const hamColor = `rgba(60, 120, 220, ${0.2 + muscleStrain * 0.4})`;

  return (
    <svg viewBox="0 0 260 400" className="knee-svg" style={{ width: "100%", maxWidth: 260, height: "auto" }}>
      <defs>
        <radialGradient id="boneGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f5e6c8" />
          <stop offset="100%" stopColor="#c8a96e" />
        </radialGradient>
        <radialGradient id="cartilageGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#b8e0f0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7ab8d4" stopOpacity="0.7" />
        </radialGradient>
        <filter id="boneShadow">
          <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="#6b4c1a" floodOpacity="0.35" />
        </filter>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="quadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dc503c" stopOpacity={0.3 + muscleStrain * 0.5} />
          <stop offset="100%" stopColor="#ff8060" stopOpacity={0.15 + muscleStrain * 0.3} />
        </linearGradient>
        <linearGradient id="hamGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3c78dc" stopOpacity={0.2 + muscleStrain * 0.4} />
          <stop offset="100%" stopColor="#60a0ff" stopOpacity={0.1 + muscleStrain * 0.3} />
        </linearGradient>
      </defs>

      {/* ── FEMUR group ── */}
      <g transform={`translate(130, 185) rotate(${femurAngle})`}>
        {/* Quadriceps muscle */}
        <ellipse cx="-22" cy="-90" rx="16" ry="75" fill="url(#quadGrad)" />
        <ellipse cx="22" cy="-90" rx="14" ry="70" fill="url(#quadGrad)" />

        {/* Femur shaft */}
        <rect x="-14" y="-170" width="28" height="155" rx="8"
          fill="url(#boneGrad)" filter="url(#boneShadow)" />
        {/* Femur condyles */}
        <ellipse cx="0" cy="-12" rx="36" ry="20"
          fill="url(#boneGrad)" filter="url(#boneShadow)" />
        <ellipse cx="-20" cy="-8" rx="18" ry="16"
          fill="url(#boneGrad)" />
        <ellipse cx="20" cy="-8" rx="18" ry="16"
          fill="url(#boneGrad)" />

        {/* Patella */}
        <ellipse cx="0" cy="-28" rx="14" ry="16"
          fill="url(#boneGrad)" filter="url(#boneShadow)" stroke="#c8a96e" strokeWidth="1" />
        <ellipse cx="0" cy="-28" rx="8" ry="10"
          fill="#f5e6c8" opacity="0.6" />

        {/* Articular cartilage on femur */}
        <ellipse cx="0" cy="-4" rx="30" ry="8"
          fill="url(#cartilageGrad)" />
      </g>

      {/* ── TIBIA group ── */}
      <g transform={`translate(130, 185) rotate(${tibiaAngle})`}>
        {/* Hamstring muscle */}
        <ellipse cx="-24" cy="80" rx="13" ry="70" fill="url(#hamGrad)" />
        <ellipse cx="24" cy="80" rx="13" ry="70" fill="url(#hamGrad)" />

        {/* Tibial plateau - articular cartilage */}
        <ellipse cx="0" cy="8" rx="28" ry="10"
          fill="url(#cartilageGrad)" />

        {/* Meniscus (lateral & medial) */}
        <path d="M-28,10 Q-14,18 -2,12 Q-14,6 -28,10Z"
          fill="#c8dde8" opacity="0.85" />
        <path d="M28,10 Q14,18 2,12 Q14,6 28,10Z"
          fill="#c8dde8" opacity="0.85" />

        {/* Tibia shaft */}
        <rect x="-12" y="12" width="24" height="155" rx="7"
          fill="url(#boneGrad)" filter="url(#boneShadow)" />
        {/* Tibial plateau wide */}
        <ellipse cx="0" cy="14" rx="32" ry="12"
          fill="url(#boneGrad)" filter="url(#boneShadow)" />

        {/* Fibula */}
        <rect x="18" y="30" width="10" height="130" rx="5"
          fill="#d4b87a" filter="url(#boneShadow)" opacity="0.8" />

        {/* Patellar tendon */}
        <path d="M-10,-22 Q-6,12 -8,24 M10,-22 Q6,12 8,24"
          stroke="#e8c878" strokeWidth="4" strokeLinecap="round" fill="none"
          transform={`translate(0,${-tibiaAngle * 0.3 + femurAngle * 0.2})`} />
      </g>

      {/* ── Ligaments (ACL/PCL visual) ── */}
      <g opacity={0.5 + muscleStrain * 0.3}>
        <line x1="122" y1="183" x2="136" y2="197"
          stroke="#f0c060" strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: muscleStrain > 0.6 ? "url(#glow)" : "none" }} />
        <line x1="138" y1="183" x2="124" y2="197"
          stroke="#60d0f0" strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: muscleStrain > 0.6 ? "url(#glow)" : "none" }} />
      </g>

      {/* ── Angle arc indicator ── */}
      <g transform="translate(130, 185)">
        <path
          d={`M 0 0 L 0 -40 A 40 40 0 ${angle > 180 ? 1 : 0} 1
            ${40 * Math.sin((angle * Math.PI) / 180)}
            ${-40 * Math.cos((angle * Math.PI) / 180)} Z`}
          fill={`rgba(100,220,180,${0.15 + muscleStrain * 0.2})`}
          stroke="rgba(100,220,180,0.7)" strokeWidth="1"
        />
        <text x="8" y="-50" fill="rgba(100,220,180,0.9)"
          fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          {angle.toFixed(1)}°
        </text>
      </g>
    </svg>
  );
}

// ─── EMG Waveform Chart ───────────────────────────────────────────────────────
function EMGChart({ rawHistory, processedHistory, label, color, bgColor }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const drawLine = (data, clr, lw, dash = []) => {
      if (data.length < 2) return;
      ctx.strokeStyle = clr;
      ctx.lineWidth = lw;
      ctx.setLineDash(dash);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - v * height * 0.9 - height * 0.05;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawLine(rawHistory, "rgba(255,255,255,0.2)", 1, [2, 2]);
    drawLine(processedHistory, color, 2);
  }, [rawHistory, processedHistory, color]);

  return (
    <div style={{
      background: bgColor,
      borderRadius: 8,
      padding: "8px 10px",
      border: "1px solid rgba(255,255,255,0.07)"
    }}>
      <div style={{
        fontSize: 9,
        letterSpacing: "0.15em",
        color: color,
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 4,
        textTransform: "uppercase"
      }}>{label}</div>
      <canvas ref={canvasRef} width={280} height={60}
        style={{ width: "100%", height: 60, display: "block", borderRadius: 4 }} />
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color, sublabel }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 2
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontFamily: "monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 11, marginLeft: 3, opacity: 0.6 }}>{unit}</span>
      </div>
      {sublabel && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{sublabel}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const HIST = 120;
  const [running, setRunning] = useState(false);
  const [smoothing, setSmoothing] = useState(0.1);
  const [maxAngle, setMaxAngle] = useState(60);
  const [smoothSpeed, setSmoothSpeed] = useState(5);
  const [activityPreset, setActivityPreset] = useState("manual");
  const [manualActivity, setManualActivity] = useState(0.4);

  const stateRef = useRef({
    t: 0,
    rawValue: 0,
    processedValue: 0,
    currentAngle: 0,
    rawHistory: Array(HIST).fill(0),
    processedHistory: Array(HIST).fill(0),
    angleHistory: Array(HIST).fill(0),
    frameCount: 0,
    sampleRate: 0,
    lastSRTime: Date.now(),
    srFrames: 0,
  });

  const displayRef = useRef({
    rawValue: 0,
    processedValue: 0,
    currentAngle: 0,
    aiOutput: 0,
    sampleRate: 0,
    rawHistory: Array(HIST).fill(0),
    processedHistory: Array(HIST).fill(0),
    angleHistory: Array(HIST).fill(0),
  });

  const [display, setDisplay] = useState(displayRef.current);
  const rafRef = useRef(null);
  const logRef = useRef([]);
  const [logEntries, setLogEntries] = useState([]);

  const getTargetActivity = useCallback((t) => {
    if (activityPreset === "manual") return manualActivity;
    if (activityPreset === "walking") return 0.5 + 0.45 * Math.sin(t * 1.8);
    if (activityPreset === "stairs") return 0.4 + 0.55 * Math.sin(t * 1.1) * (0.5 + 0.5 * Math.sin(t * 0.4));
    if (activityPreset === "running") return 0.6 + 0.38 * Math.sin(t * 3.2);
    if (activityPreset === "rehab") return 0.25 + 0.2 * Math.sin(t * 0.7);
    return manualActivity;
  }, [activityPreset, manualActivity]);

  useEffect(() => {
    if (!running) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }

    const DT = 1 / 60;
    const loop = () => {
      const s = stateRef.current;
      s.t += DT;
      s.frameCount++;
      s.srFrames++;
      const now = Date.now();
      if (now - s.lastSRTime >= 1000) {
        s.sampleRate = s.srFrames;
        s.srFrames = 0;
        s.lastSRTime = now;
      }

      const activity = Math.min(1, Math.max(0, getTargetActivity(s.t)));
      s.rawValue = generateEMGNoise(s.t, activity);
      s.processedValue = processEMG(s.rawValue, s.processedValue, smoothing);
      const aiOut = predict(s.processedValue);
      const targetAngle = aiOut * maxAngle;
      const lerpFactor = 1 - Math.exp(-smoothSpeed * DT);
      s.currentAngle = s.currentAngle + lerpFactor * (targetAngle - s.currentAngle);

      s.rawHistory = [...s.rawHistory.slice(1), s.rawValue];
      s.processedHistory = [...s.processedHistory.slice(1), s.processedValue];
      s.angleHistory = [...s.angleHistory.slice(1), s.currentAngle / maxAngle];

      displayRef.current = {
        rawValue: s.rawValue,
        processedValue: s.processedValue,
        currentAngle: s.currentAngle,
        aiOutput: aiOut,
        sampleRate: s.sampleRate,
        rawHistory: s.rawHistory,
        processedHistory: s.processedHistory,
        angleHistory: s.angleHistory,
      };

      if (s.frameCount % 6 === 0) setDisplay({ ...displayRef.current });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, smoothing, maxAngle, smoothSpeed, getTargetActivity]);

  const logSnapshot = () => {
    const d = displayRef.current;
    const entry = {
      t: new Date().toLocaleTimeString(),
      angle: d.currentAngle.toFixed(2),
      emg: d.processedValue.toFixed(4),
      ai: d.aiOutput.toFixed(4),
      preset: activityPreset,
    };
    logRef.current = [entry, ...logRef.current.slice(0, 19)];
    setLogEntries([...logRef.current]);
  };

  const resetLog = () => { logRef.current = []; setLogEntries([]); };

  const exportCSV = () => {
    const header = "Timestamp,Activity,EMG_Raw,EMG_Processed,AI_Output,Knee_Angle_deg\n";
    const rows = logRef.current.map(e =>
      `${e.t},${e.preset},${e.emg},${e.emg},${e.ai},${e.angle}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "emg_knee_data.csv";
    a.click();
  };

  const presets = ["manual", "walking", "stairs", "running", "rehab"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0c10",
      color: "#e8eaf0",
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
      padding: "0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0c10; }
        input[type=range] {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px; background: rgba(255,255,255,0.1);
          border-radius: 2px; outline: none; cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: #4de8b0; cursor: pointer;
          transition: transform 0.15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .pulse-dot {
          width: 8px; height: 8px; border-radius: 50%;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        .btn {
          border: none; cursor: pointer; border-radius: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: 0.08em;
          font-weight: 600; transition: all 0.15s;
          display: flex; align-items: center; gap: 6px;
        }
        .btn:hover { transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .preset-btn {
          padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
          cursor: pointer; font-size: 10px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.1em; text-transform: uppercase;
          transition: all 0.15s;
        }
        .preset-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
        .preset-btn.active {
          background: rgba(77,232,176,0.12); border-color: rgba(77,232,176,0.4);
          color: #4de8b0;
        }
        scrollbar-width: thin;
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "18px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.02)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #4de8b0, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18
          }}>🦿</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.02em" }}>
              EMG Knee Controller
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace" }}>
              Prosthetic Research Simulator · v2.0
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {running && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#4de8b0", fontFamily: "monospace" }}>
              <div className="pulse-dot" style={{ background: "#4de8b0" }} />
              LIVE · {display.sampleRate} Hz
            </div>
          )}
          <button
            className="btn"
            onClick={() => setRunning(r => !r)}
            style={{
              padding: "9px 20px",
              background: running
                ? "rgba(255,80,80,0.15)"
                : "rgba(77,232,176,0.15)",
              color: running ? "#ff5050" : "#4de8b0",
              border: `1px solid ${running ? "rgba(255,80,80,0.3)" : "rgba(77,232,176,0.3)"}`,
            }}>
            {running ? "⏹ STOP" : "▶ RUN"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px 320px",
        gap: 0,
        flex: 1,
        minHeight: 0,
      }}>

        {/* ── LEFT: Knee Visualizer ── */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 20
        }}>
          <div style={{
            fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)", fontFamily: "monospace"
          }}>JOINT VISUALIZATION</div>

          {/* Anatomy */}
          <div style={{
            background: "radial-gradient(ellipse at center, rgba(30,40,60,0.8) 0%, rgba(10,12,16,0.95) 70%)",
            borderRadius: 16, padding: "20px 10px",
            border: "1px solid rgba(255,255,255,0.05)",
            width: "100%", maxWidth: 300,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            position: "relative", overflow: "hidden"
          }}>
            {/* EMG heatmap glow */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: 16,
              background: `radial-gradient(ellipse at 50% 50%, rgba(${display.aiOutput > 0.5 ? "220,80,60" : "60,120,220"},${display.processedValue * 0.15}) 0%, transparent 70%)`,
              transition: "background 0.3s", pointerEvents: "none"
            }} />

            <KneeAnatomySVG
              angle={display.currentAngle}
              emgActivity={display.processedValue}
            />

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, fontSize: 9, fontFamily: "monospace" }}>
              {[
                ["#f5e6c8", "Bone"],
                ["#b8e0f0", "Cartilage / Meniscus"],
                ["rgba(220,80,60,0.7)", "Quadriceps"],
                ["rgba(60,120,220,0.7)", "Hamstring"],
              ].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.4)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Metrics Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
            <MetricCard label="Knee Angle" value={display.currentAngle.toFixed(1)} unit="°" color="#4de8b0" sublabel="Flexion" />
            <MetricCard label="AI Output" value={(display.aiOutput * 100).toFixed(1)} unit="%" color="#3b82f6" sublabel="Neural Prediction" />
            <MetricCard label="EMG Raw" value={display.rawValue.toFixed(3)} unit="mV" color="#f59e0b" sublabel="Rectified" />
            <MetricCard label="EMG Filtered" value={display.processedValue.toFixed(3)} unit="mV" color="#a78bfa" sublabel="Low-pass" />
          </div>

          {/* Angle bar */}
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: 5 }}>
              <span>0°</span><span>FLEXION RANGE</span><span>{maxAngle}°</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${(display.currentAngle / maxAngle) * 100}%`,
                background: "linear-gradient(90deg, #4de8b0, #3b82f6)",
                transition: "width 0.05s", boxShadow: "0 0 8px rgba(77,232,176,0.4)"
              }} />
            </div>
          </div>
        </div>

        {/* ── CENTER: Parameters ── */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "24px 20px",
          display: "flex", flexDirection: "column", gap: 20,
          overflowY: "auto"
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
            PARAMETERS
          </div>

          {/* Activity Presets */}
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.1em" }}>
              ACTIVITY PRESET
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {presets.map(p => (
                <button key={p} className={`preset-btn${activityPreset === p ? " active" : ""}`}
                  onClick={() => setActivityPreset(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Manual EMG slider */}
          {activityPreset === "manual" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>EMG ACTIVITY</span>
                <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace" }}>{(manualActivity * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.01"
                value={manualActivity}
                onChange={e => setManualActivity(+e.target.value)} />
            </div>
          )}

          {/* Smoothing Factor */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>SMOOTHING FACTOR</span>
              <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace" }}>{smoothing.toFixed(2)}</span>
            </div>
            <input type="range" min="0.01" max="1" step="0.01"
              value={smoothing} onChange={e => setSmoothing(+e.target.value)} />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4, fontFamily: "monospace" }}>
              EMGProcessor.smoothingFactor → Low-pass filter α
            </div>
          </div>

          {/* Max Angle */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>MAX ANGLE</span>
              <span style={{ fontSize: 11, color: "#4de8b0", fontFamily: "monospace" }}>{maxAngle}°</span>
            </div>
            <input type="range" min="10" max="120" step="1"
              value={maxAngle} onChange={e => setMaxAngle(+e.target.value)} />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4, fontFamily: "monospace" }}>
              AIKneeController.maxAngle
            </div>
          </div>

          {/* Smooth Speed */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>LERP SPEED</span>
              <span style={{ fontSize: 11, color: "#3b82f6", fontFamily: "monospace" }}>{smoothSpeed.toFixed(1)}</span>
            </div>
            <input type="range" min="0.5" max="20" step="0.5"
              value={smoothSpeed} onChange={e => setSmoothSpeed(+e.target.value)} />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4, fontFamily: "monospace" }}>
              AIKneeController.smoothSpeed → Quaternion.Lerp
            </div>
          </div>

          {/* Pipeline Diagram */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: "14px"
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: "monospace" }}>
              SIGNAL PIPELINE
            </div>
            {[
              { label: "Raw EMG", value: display.rawValue.toFixed(3), color: "#f59e0b", file: "EMGProcessor" },
              { label: "Rectify |x|", value: `→`, color: "#6b7280", file: "" },
              { label: "Low-pass α", value: display.processedValue.toFixed(3), color: "#a78bfa", file: "EMGProcessor" },
              { label: "Clamp [0,1]", value: display.aiOutput.toFixed(3), color: "#3b82f6", file: "EMGNeuralNetwork" },
              { label: "× maxAngle", value: `${display.currentAngle.toFixed(1)}°`, color: "#4de8b0", file: "AIKneeController" },
            ].map(({ label, value, color, file }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)"
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>{label}</div>
                  {file && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{file}.cs</div>}
                </div>
                <div style={{ fontSize: 12, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Charts + Log ── */}
        <div style={{
          padding: "24px 20px",
          display: "flex", flexDirection: "column", gap: 16,
          overflowY: "auto"
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
            SIGNAL MONITOR
          </div>

          <EMGChart
            rawHistory={display.rawHistory}
            processedHistory={display.processedHistory}
            label="EMG Signal (Raw ╌ / Filtered ─)"
            color="#a78bfa"
            bgColor="rgba(167,139,250,0.05)"
          />

          <EMGChart
            rawHistory={display.angleHistory}
            processedHistory={display.angleHistory}
            label="Knee Angle (normalized)"
            color="#4de8b0"
            bgColor="rgba(77,232,176,0.05)"
          />

          {/* Research Log */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: "12px", flex: 1
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", textTransform: "uppercase" }}>
                Research Log
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn" onClick={logSnapshot} style={{
                  padding: "5px 10px", background: "rgba(77,232,176,0.1)",
                  color: "#4de8b0", border: "1px solid rgba(77,232,176,0.2)"
                }}>⬤ SNAP</button>
                <button className="btn" onClick={exportCSV} style={{
                  padding: "5px 10px", background: "rgba(59,130,246,0.1)",
                  color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)"
                }}>↓ CSV</button>
                <button className="btn" onClick={resetLog} style={{
                  padding: "5px 10px", background: "rgba(255,80,80,0.08)",
                  color: "#ff5050", border: "1px solid rgba(255,80,80,0.15)"
                }}>✕</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", maxHeight: 200 }}>
              {logEntries.length === 0 ? (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", textAlign: "center", padding: "20px 0" }}>
                  Press SNAP to record a data point
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.3)" }}>
                      {["Time", "Preset", "EMG", "AI Out", "Angle°"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "3px 5px", letterSpacing: "0.08em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map((e, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "3px 5px", color: "rgba(255,255,255,0.35)" }}>{e.t}</td>
                        <td style={{ padding: "3px 5px", color: "#4de8b0" }}>{e.preset}</td>
                        <td style={{ padding: "3px 5px", color: "#a78bfa" }}>{e.emg}</td>
                        <td style={{ padding: "3px 5px", color: "#3b82f6" }}>{e.ai}</td>
                        <td style={{ padding: "3px 5px", color: "#f59e0b" }}>{e.angle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Info Block */}
          <div style={{
            background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 8, padding: "10px 12px", fontSize: 9,
            color: "rgba(255,255,255,0.35)", fontFamily: "monospace", lineHeight: 1.7
          }}>
            <strong style={{ color: "#3b82f6", letterSpacing: "0.08em" }}>PIPELINE</strong><br />
            EMGProcessor → Rectify → LPF(α) →<br />
            EMGNeuralNetwork → Clamp[0,1] →<br />
            AIKneeController → Lerp(targetAngle, speed)
          </div>
        </div>
      </div>
    </div>
  );
}
