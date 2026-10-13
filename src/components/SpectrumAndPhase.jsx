import React, { useRef, useEffect } from "react";

export default function SpectrumAndPhase({
  fftSpectrum = [],
  medianFrequency = 115,
  fatigueLevel = 0.0,
  orbitHistory = [], // [{ angle, velocity }]
  kneeAngle = 15,
  kneeVelocity = 0,
}) {
  const specCanvasRef = useRef(null);
  const phaseCanvasRef = useRef(null);

  // Draw FFT Power Spectrum
  useEffect(() => {
    const canvas = specCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const bins = fftSpectrum.length || 32;
    const barWidth = width / bins;
    const isFatigued = medianFrequency < 80;

    // Draw bars
    fftSpectrum.forEach((power, i) => {
      const h = Math.min(height - 10, power * 28);
      const x = i * barWidth;
      const y = height - h;
      ctx.fillStyle = isFatigued
        ? "rgba(239, 68, 68, 0.75)"
        : i < 16
        ? "rgba(56, 189, 248, 0.8)"
        : "rgba(168, 85, 247, 0.6)";
      ctx.fillRect(x + 1, y, barWidth - 2, h);
    });

    // Draw Median Frequency (MDF) Cursor line
    const mdfX = (medianFrequency / 500) * width;
    ctx.strokeStyle = isFatigued ? "#ef4444" : "#4ade80";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(mdfX, 0);
    ctx.lineTo(mdfX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [fftSpectrum, medianFrequency, fatigueLevel]);

  // Draw Phase Portrait (theta vs theta_dot)
  useEffect(() => {
    const canvas = phaseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.45;
    const cy = height * 0.5;

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();

    // Trace orbital limit cycle
    if (orbitHistory.length > 2) {
      ctx.strokeStyle = "rgba(74, 222, 128, 0.65)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      orbitHistory.forEach((pt, i) => {
        const x = cx + (pt.angle / 75) * (width * 0.5);
        const y = cy - (pt.velocity / 200) * (height * 0.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Current head point
      const curX = cx + (kneeAngle / 75) * (width * 0.5);
      const curY = cy - (kneeVelocity / 200) * (height * 0.4);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [orbitHistory, kneeAngle, kneeVelocity]);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}>
      {/* FFT Power Spectrum */}
      <div style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 10,
        padding: "10px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
            LIVE FFT POWER SPECTRUM
          </div>
          <div style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            color: medianFrequency < 80 ? "#ef4444" : "#4ade80"
          }}>
            MDF: {medianFrequency} Hz {medianFrequency < 80 ? "?? FATIGUED" : "NORMAL"}
          </div>
        </div>
        <canvas ref={specCanvasRef} width={150} height={75} style={{ width: "100%", height: 75, display: "block", background: "#090d16", borderRadius: 4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 4 }}>
          <span>0 Hz</span>
          <span>FATIGUE MDF CURSOR (?)</span>
          <span>500 Hz</span>
        </div>
      </div>

      {/* Gait Phase Orbit */}
      <div style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 10,
        padding: "10px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
            GAIT LIMIT CYCLE (? vs ??)
          </div>
          <div style={{ fontSize: 9, color: "#38bdf8", fontFamily: "monospace" }}>
            ORBIT
          </div>
        </div>
        <canvas ref={phaseCanvasRef} width={150} height={75} style={{ width: "100%", height: 75, display: "block", background: "#090d16", borderRadius: 4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 4 }}>
          <span>0?</span>
          <span>LIMIT CYCLE STABILITY</span>
          <span>75? Flex</span>
        </div>
      </div>
    </div>
  );
}
