import React, { useRef, useEffect } from "react";

export default function SignalOscilloscope({
  rawQuadHistory = [],
  filtQuadHistory = [],
  rawHamHistory = [],
  filtHamHistory = [],
  quadRecruitment = 0.5,
  hamRecruitment = 0.3,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const chHeight = height / 2;

    // Background Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Zero-lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(0, chHeight * 0.5);
    ctx.lineTo(width, chHeight * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, chHeight + chHeight * 0.5);
    ctx.lineTo(width, chHeight + chHeight * 0.5);
    ctx.stroke();

    // Divider between channels
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(0, chHeight);
    ctx.lineTo(width, chHeight);
    ctx.stroke();

    // Helper to draw waveform
    const drawTrace = (data, baseY, scaleY, strokeStyle, lineWidth, dash = []) => {
      if (!data || data.length < 2) return;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      const len = data.length;
      data.forEach((val, i) => {
        const x = (i / (len - 1)) * width;
        const y = baseY - val * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Channel 1: Quadriceps (Extensor)
    // Raw MUAP
    drawTrace(rawQuadHistory, chHeight * 0.5, chHeight * 0.42, "rgba(245, 158, 11, 0.4)", 1);
    // Filtered RMS Envelope
    drawTrace(filtQuadHistory, chHeight * 0.85, chHeight * 0.7, "#f59e0b", 2);

    // Channel 2: Hamstrings (Flexor)
    // Raw MUAP
    drawTrace(rawHamHistory, chHeight + chHeight * 0.5, chHeight * 0.42, "rgba(56, 189, 248, 0.4)", 1);
    // Filtered RMS Envelope
    drawTrace(filtHamHistory, chHeight + chHeight * 0.85, chHeight * 0.7, "#38bdf8", 2);
  }, [rawQuadHistory, filtQuadHistory, rawHamHistory, filtHamHistory]);

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.6)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: 10,
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "rgba(255, 255, 255, 0.4)",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600
        }}>
          DUAL-CHANNEL EMG OSCILLOSCOPE (1000 Hz DSP)
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 9, fontFamily: "monospace" }}>
          <span style={{ color: "#f59e0b" }}>CH1: QUAD ({(quadRecruitment * 100).toFixed(0)}%)</span>
          <span style={{ color: "#38bdf8" }}>CH2: HAM ({(hamRecruitment * 100).toFixed(0)}%)</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={340}
        height={130}
        style={{ width: "100%", height: 130, display: "block", borderRadius: 6, background: "#090d16" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
        <span>T - 1.2s</span>
        <span>RAW (?) / RMS ENVELOPE (?)</span>
        <span>T (LIVE)</span>
      </div>
    </div>
  );
}
