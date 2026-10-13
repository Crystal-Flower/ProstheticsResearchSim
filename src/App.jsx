import React, { useState, useEffect, useRef, useCallback } from "react";
import BionicKneeSVG from "./components/BionicKneeSVG.jsx";
import AnatomyKneeSVG from "./components/AnatomyKneeSVG.jsx";
import SignalOscilloscope from "./components/SignalOscilloscope.jsx";
import SpectrumAndPhase from "./components/SpectrumAndPhase.jsx";
import CalibrationModal from "./components/CalibrationModal.jsx";
import { BiomechanicalLeg, getGaitPhase, GAIT_PHASES } from "./models/biomechanics.js";
import {
  CONTROLLER_MODES,
  runBaselineController,
  runHillController,
  OnlineAdaptiveMLP,
  BiomimeticImpedanceController,
} from "./models/aiControllers.js";
import { EMGSynthesizer, SignalProcessor, computeFFT32 } from "./dsp/emgEngine.js";
import { AudioBioInput } from "./dsp/audioBioInput.js";

const HIST = 120;

export default function App() {
  const [running, setRunning] = useState(true);
  const [viewMode, setViewMode] = useState("bionic"); // "bionic" | "anatomy"
  const [controllerMode, setControllerMode] = useState("impedance"); // "impedance" | "mlp" | "hill" | "baseline"
  const [activityPreset, setActivityPreset] = useState("walking");
  const [quadManual, setQuadManual] = useState(0.45);
  const [hamManual, setHamManual] = useState(0.25);
  const [maxAngle, setMaxAngle] = useState(68);
  const [smoothSpeed, setSmoothSpeed] = useState(7.5);
  const [baseStiffness, setBaseStiffness] = useState(160);
  const [baseDamping, setBaseDamping] = useState(14);
  const [stumbleActive, setStumbleActive] = useState(false);
  const [stumblesCaught, setStumblesCaught] = useState(0);
  const [audioBioActive, setAudioBioActive] = useState(false);
  const [calibOpen, setCalibOpen] = useState(false);
  const [logEntries, setLogEntries] = useState([]);

  const audioInputRef = useRef(new AudioBioInput());
  const legRef = useRef(new BiomechanicalLeg());
  const emgEngineRef = useRef(new EMGSynthesizer());
  const dspRef = useRef(new SignalProcessor(24));
  const mlpRef = useRef(new OnlineAdaptiveMLP());
  const impedanceRef = useRef(new BiomimeticImpedanceController());

  const stateRef = useRef({
    t: 0,
    gaitProgress: 0,
    kneeAngle: 6,
    kneeVelocity: 0,
    targetAngle: 6,
    stiffness: 160,
    damping: 14,
    torque: 0,
    grf: 700,
    isStable: true,
    stabilityMargin: 15,
    sampleRate: 0,
    srFrames: 0,
    lastSRTime: Date.now(),
    fatigueLevel: 0,
    medianFreq: 120,
    rawQuadHistory: Array(HIST).fill(0),
    filtQuadHistory: Array(HIST).fill(0),
    rawHamHistory: Array(HIST).fill(0),
    filtHamHistory: Array(HIST).fill(0),
    orbitHistory: Array(70).fill({ angle: 6, velocity: 0 }),
    fftSpectrum: Array(32).fill(0.1),
    bioState: {
      quadActivation: 0.1,
      hamActivation: 0.1,
      quadForce: 200,
      hamForce: 100,
      coContraction: 0.1,
    },
  });

  const [display, setDisplay] = useState(stateRef.current);
  const rafRef = useRef(null);

  const toggleAudioBio = async () => {
    if (audioBioActive) {
      audioInputRef.current.stop();
      setAudioBioActive(false);
    } else {
      const ok = await audioInputRef.current.start();
      if (ok) setAudioBioActive(true);
      else alert("Microphone access was denied or is not supported in this browser.");
    }
  };

  const triggerStumble = () => {
    legRef.current.triggerStumble();
    setStumbleActive(true);
    setStumblesCaught((c) => c + 1);
    setTimeout(() => {
      setStumbleActive(false);
    }, 850);
  };

  const getGaitExcitation = useCallback((t, progress) => {
    if (activityPreset === "manual") {
      return { q: quadManual, h: hamManual };
    }
    if (activityPreset === "walking") {
      const q = progress < 0.25 ? 0.75 * Math.sin((progress / 0.25) * Math.PI) : 0.08;
      const h = progress > 0.65 ? 0.65 * Math.sin(((progress - 0.65) / 0.35) * Math.PI) : 0.05;
      return { q, h };
    }
    if (activityPreset === "stairs") {
      const q = progress < 0.4 ? 0.95 * Math.sin((progress / 0.4) * Math.PI) : 0.12;
      const h = progress > 0.55 ? 0.85 * Math.sin(((progress - 0.55) / 0.45) * Math.PI) : 0.08;
      return { q, h };
    }
    if (activityPreset === "sprint") {
      const q = 0.5 + 0.45 * Math.sin(t * 7.5);
      const h = 0.4 + 0.45 * Math.cos(t * 7.5);
      return { q: Math.max(0.1, q), h: Math.max(0.1, h) };
    }
    if (activityPreset === "ramp") {
      const q = progress < 0.5 ? 0.85 : 0.15;
      const h = progress > 0.6 ? 0.4 : 0.05;
      return { q, h };
    }
    if (activityPreset === "rehab") {
      const q = 0.25 + 0.15 * Math.sin(t * 1.5);
      const h = 0.2 + 0.12 * Math.cos(t * 1.5);
      return { q, h };
    }
    return { q: quadManual, h: hamManual };
  }, [activityPreset, quadManual, hamManual]);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const DT = 1 / 60;
    const loop = () => {
      const s = stateRef.current;
      s.t += DT;
      s.srFrames++;

      const stepDuration = activityPreset === "sprint" ? 0.7 : activityPreset === "stairs" ? 1.4 : 1.1;
      s.gaitProgress = (s.t / stepDuration) % 1.0;

      const now = Date.now();
      if (now - s.lastSRTime >= 1000) {
        s.sampleRate = s.srFrames;
        s.srFrames = 0;
        s.lastSRTime = now;
      }

      let { q: qTarget, h: hTarget } = getGaitExcitation(s.t, s.gaitProgress);

      if (audioBioActive && audioInputRef.current.isActive) {
        const audioRec = audioInputRef.current.getRecruitment();
        qTarget = Math.max(qTarget, audioRec.quadSignal);
        hTarget = Math.max(hTarget, audioRec.hamSignal);
      }

      const emgOut = emgEngineRef.current.step(DT, qTarget, hTarget);
      s.fatigueLevel = emgOut.fatigueLevel;

      const dspOut = dspRef.current.process(emgOut.rawQuad, emgOut.rawHam);
      const bio = legRef.current.update(DT, dspOut.filteredQuad, dspOut.filteredHam);
      s.bioState = bio;

      let ctrlRes;
      if (controllerMode === "baseline") {
        ctrlRes = runBaselineController(dspOut.filteredQuad, s.kneeAngle, maxAngle, smoothSpeed, DT);
      } else if (controllerMode === "hill") {
        ctrlRes = runHillController(bio, s.kneeAngle, maxAngle, smoothSpeed, DT);
      } else if (controllerMode === "mlp") {
        ctrlRes = mlpRef.current.forward(
          dspOut.filteredQuad,
          dspOut.filteredHam,
          s.kneeAngle,
          maxAngle,
          smoothSpeed,
          DT,
          legRef.current.stumbleActive
        );
      } else {
        ctrlRes = impedanceRef.current.compute(
          s.gaitProgress,
          dspOut.filteredQuad,
          dspOut.filteredHam,
          s.kneeAngle,
          maxAngle,
          DT,
          legRef.current.stumbleActive
        );
      }

      const prevAngle = s.kneeAngle;
      s.targetAngle = ctrlRes.targetAngle;
      s.kneeAngle = ctrlRes.currentAngle;
      s.kneeVelocity = (s.kneeAngle - prevAngle) / DT;
      s.stiffness = ctrlRes.stiffness || baseStiffness;
      s.damping = ctrlRes.damping || baseDamping;
      s.torque = ctrlRes.torque || 0;

      const inStance = s.gaitProgress < 0.6;
      s.grf = inStance ? 680 * (0.8 + 0.45 * Math.sin((s.gaitProgress / 0.6) * Math.PI)) : 0;
      s.isStable = s.kneeAngle < 38 && !legRef.current.stumbleActive;
      s.stabilityMargin = s.isStable ? 22 - (s.kneeAngle / 38) * 15 : -18;

      s.rawQuadHistory = [...s.rawQuadHistory.slice(1), emgOut.rawQuad];
      s.filtQuadHistory = [...s.filtQuadHistory.slice(1), dspOut.filteredQuad];
      s.rawHamHistory = [...s.rawHamHistory.slice(1), emgOut.rawHam];
      s.filtHamHistory = [...s.filtHamHistory.slice(1), dspOut.filteredHam];
      s.orbitHistory = [...s.orbitHistory.slice(1), { angle: s.kneeAngle, velocity: s.kneeVelocity }];

      if (Math.floor(s.t * 60) % 4 === 0) {
        const fft = computeFFT32(s.rawQuadHistory);
        s.fftSpectrum = fft.spectrum;
        s.medianFreq = fft.medianFrequency;
      }

      if (Math.floor(s.t * 60) % 2 === 0) {
        setDisplay({ ...s });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    running,
    controllerMode,
    activityPreset,
    maxAngle,
    smoothSpeed,
    baseStiffness,
    baseDamping,
    audioBioActive,
    getGaitExcitation,
  ]);

  const takeSnapshot = () => {
    const currentPhase = getGaitPhase(display.gaitProgress);
    const entry = {
      t: new Date().toLocaleTimeString(),
      controller: controllerMode,
      phase: currentPhase.name,
      angle: display.kneeAngle.toFixed(1),
      quadEMG: display.filtQuadHistory[display.filtQuadHistory.length - 1].toFixed(3),
      hamEMG: display.filtHamHistory[display.filtHamHistory.length - 1].toFixed(3),
      stiffness: display.stiffness.toFixed(0),
      damping: display.damping.toFixed(1),
      torque: display.torque.toFixed(2),
      mdf: display.medianFreq,
    };
    setLogEntries((prev) => [entry, ...prev.slice(0, 24)]);
  };

  const exportCSV = () => {
    const header = "Timestamp,Controller,Gait_Phase,Knee_Angle_deg,Quad_EMG_mV,Ham_EMG_mV,Stiffness_Nm_rad,Damping_Nms_rad,Torque_Nm,MDF_Hz\n";
    const rows = logEntries.map(
      (e) => `${e.t},${e.controller},${e.phase},${e.angle},${e.quadEMG},${e.hamEMG},${e.stiffness},${e.damping},${e.torque},${e.mdf}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prosthetics_telemetry_${Date.now()}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const sessionData = {
      timestamp: new Date().toISOString(),
      controllerMode,
      activityPreset,
      stumblesCaught,
      maxAngle,
      baseStiffness,
      baseDamping,
      telemetryLog: logEntries,
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prosthetic_experiment_${Date.now()}.json`;
    a.click();
  };

  const currentPhase = getGaitPhase(display.gaitProgress);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07090e",
      color: "#e2e8f0",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07090e; }
        input[type=range] {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; background: rgba(255,255,255,0.12);
          border-radius: 2px; outline: none; cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: #38bdf8; cursor: pointer;
          transition: transform 0.15s, background 0.15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.3); background: #4ade80; }
        .btn {
          border: none; cursor: pointer; border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: 0.06em;
          font-weight: 600; transition: all 0.15s;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn:hover { transform: translateY(-1px); filter: brightness(1.15); }
        .btn:active { transform: translateY(0); }
        .preset-btn {
          padding: 5px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.6);
          cursor: pointer; font-size: 10px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.08em; text-transform: uppercase;
          transition: all 0.15s;
        }
        .preset-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .preset-btn.active {
          background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.5);
          color: #38bdf8; font-weight: 600;
        }
        .pulse-dot {
          width: 8px; height: 8px; border-radius: 50%;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        padding: "12px 24px",
        background: "rgba(15, 23, 42, 0.75)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #38bdf8, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: "0 0 15px rgba(56,189,248,0.3)"
          }}>
            ??
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em", color: "#f8fafc" }}>
              NEURO-BIONIC SIM
              <span style={{ fontSize: 10, marginLeft: 8, padding: "2px 6px", borderRadius: 4, background: "rgba(56,189,248,0.2)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.4)" }}>
                v3.0 NOVEL SOTA
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
              Multi-Channel Agonist-Antagonist EMG ? Hill MTU ? Variable Impedance ? Fall-Prevention Autopilot
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", background: "rgba(0,0,0,0.4)", padding: 3, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <button
              onClick={() => setViewMode("bionic")}
              style={{
                padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                background: viewMode === "bionic" ? "#38bdf8" : "transparent",
                color: viewMode === "bionic" ? "#0f172a" : "rgba(255,255,255,0.6)",
                fontSize: 10, fontFamily: "monospace", fontWeight: 600
              }}
            >
              ?? BIONIC CAD
            </button>
            <button
              onClick={() => setViewMode("anatomy")}
              style={{
                padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                background: viewMode === "anatomy" ? "#38bdf8" : "transparent",
                color: viewMode === "anatomy" ? "#0f172a" : "rgba(255,255,255,0.6)",
                fontSize: 10, fontFamily: "monospace", fontWeight: 600
              }}
            >
              ?? ANATOMY
            </button>
          </div>

          <button
            onClick={toggleAudioBio}
            className="btn"
            style={{
              padding: "7px 12px",
              background: audioBioActive ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
              color: audioBioActive ? "#4ade80" : "rgba(255,255,255,0.7)",
              border: `1px solid ${audioBioActive ? "#4ade80" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            ?? {audioBioActive ? "MIC ACTIVE" : "AUDIO EMG"}
          </button>

          <button
            onClick={() => setCalibOpen(true)}
            className="btn"
            style={{
              padding: "7px 12px",
              background: "rgba(168, 85, 247, 0.15)",
              color: "#c084fc",
              border: "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            ? CALIBRATE
          </button>

          <button
            onClick={triggerStumble}
            className="btn"
            style={{
              padding: "7px 14px",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              boxShadow: stumbleActive ? "0 0 15px rgba(239, 68, 68, 0.6)" : "none",
            }}
          >
            ?? INJECT STUMBLE ({stumblesCaught})
          </button>

          <button
            onClick={() => setRunning((r) => !r)}
            className="btn"
            style={{
              padding: "7px 18px",
              background: running ? "rgba(239, 68, 68, 0.15)" : "rgba(56, 189, 248, 0.15)",
              color: running ? "#f87171" : "#38bdf8",
              border: `1px solid ${running ? "rgba(239, 68, 68, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
            }}
          >
            {running ? "? PAUSE" : "? START"}
          </button>
        </div>
      </header>

      {/* MAIN THREE-COLUMN WORKSPACE */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "380px 1fr 420px",
        flex: 1,
        minHeight: 0,
        gap: 0,
      }}>
        {/* LEFT COLUMN: Visualizer & Live Kinematics */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "rgba(10, 14, 23, 0.5)",
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
              {viewMode === "bionic" ? "BIONIC CAD PROSTHETIC JOINT" : "BIOLOGICAL MUSCULOSKELETAL JOINT"}
            </div>
            <div style={{ fontSize: 9, color: currentPhase.color, fontFamily: "monospace", fontWeight: 600 }}>
              {currentPhase.name}
            </div>
          </div>

          <div style={{
            background: "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(7, 9, 14, 0.95) 80%)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "10px",
            position: "relative",
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.6)",
          }}>
            {viewMode === "bionic" ? (
              <BionicKneeSVG
                angle={display.kneeAngle}
                stiffness={display.stiffness}
                damping={display.damping}
                torque={display.torque}
                stumbleActive={legRef.current.stumbleActive}
                gaitPhase={currentPhase}
                groundReactionForce={display.grf}
              />
            ) : (
              <AnatomyKneeSVG
                angle={display.kneeAngle}
                quadActivation={display.bioState.quadActivation}
                hamActivation={display.bioState.hamActivation}
                quadForce={display.bioState.quadForce}
                hamForce={display.bioState.hamForce}
                coContraction={display.bioState.coContraction}
              />
            )}
          </div>

          {/* 5-Phase Gait Cycle Timeline Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 6 }}>
              <span>GAIT CYCLE PHASE</span>
              <span style={{ color: currentPhase.color, fontWeight: 600 }}>{(display.gaitProgress * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
              {GAIT_PHASES.map((p) => {
                const widthPct = (p.range[1] - p.range[0]) * 100;
                const isCur = currentPhase.id === p.id;
                return (
                  <div
                    key={p.id}
                    title={p.name + ": " + p.desc}
                    style={{
                      width: `${widthPct}%`,
                      background: isCur ? p.color : "rgba(255,255,255,0.1)",
                      opacity: isCur ? 1 : 0.4,
                      boxShadow: isCur ? `0 0 8px ${p.color}` : "none",
                      transition: "all 0.15s",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 4 }}>
              {currentPhase.desc}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>FLEXION ANGLE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8", fontFamily: "monospace" }}>
                {display.kneeAngle.toFixed(1)}?
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>NET TORQUE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>
                {display.torque.toFixed(1)} <span style={{ fontSize: 10 }}>N?m</span>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>JOINT STIFFNESS (K)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>
                {display.stiffness.toFixed(0)} <span style={{ fontSize: 9 }}>Nm/rad</span>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>DAMPING (B)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: display.damping > 30 ? "#ef4444" : "#a855f7", fontFamily: "monospace" }}>
                {display.damping.toFixed(1)} <span style={{ fontSize: 9 }}>Nms/rad</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Biomechanical & Neural Control Center */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          overflowY: "auto",
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>
              COMPARATIVE AI & BIOMECHANICAL CONTROL ARCHITECTURE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CONTROLLER_MODES.map((mode) => {
                const isActive = controllerMode === mode.id;
                return (
                  <div
                    key={mode.id}
                    onClick={() => setControllerMode(mode.id)}
                    style={{
                      background: isActive ? "rgba(56, 189, 248, 0.12)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isActive ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#38bdf8" : "#f1f5f9" }}>
                        {mode.name}
                      </span>
                      <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: `${mode.badgeColor}22`, color: mode.badgeColor, border: `1px solid ${mode.badgeColor}55`, fontFamily: "monospace" }}>
                        {mode.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                      {mode.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>
              PHYSIOLOGICAL GAIT PRESETS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["walking", "stairs", "sprint", "ramp", "rehab", "manual"].map((preset) => (
                <button
                  key={preset}
                  className={`preset-btn${activityPreset === preset ? " active" : ""}`}
                  onClick={() => setActivityPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
              AGONIST-ANTAGONIST MUSCLE RECRUITMENT
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "#f59e0b" }}>CH1: QUADRICEPS (EXTENSOR)</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                  {activityPreset === "manual" ? `${(quadManual * 100).toFixed(0)}%` : `${(display.bioState.quadActivation * 100).toFixed(0)}% LIVE`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activityPreset === "manual" ? quadManual : display.bioState.quadActivation}
                onChange={(e) => {
                  setActivityPreset("manual");
                  setQuadManual(+e.target.value);
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "#38bdf8" }}>CH2: HAMSTRINGS (FLEXOR)</span>
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                  {activityPreset === "manual" ? `${(hamManual * 100).toFixed(0)}%` : `${(display.bioState.hamActivation * 100).toFixed(0)}% LIVE`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activityPreset === "manual" ? hamManual : display.bioState.hamActivation}
                onChange={(e) => {
                  setActivityPreset("manual");
                  setHamManual(+e.target.value);
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>MAX FLEXION</span>
                <span style={{ color: "#38bdf8" }}>{maxAngle}?</span>
              </div>
              <input type="range" min="30" max="110" step="1" value={maxAngle} onChange={(e) => setMaxAngle(+e.target.value)} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>CONTROL LERP SPEED</span>
                <span style={{ color: "#38bdf8" }}>{smoothSpeed.toFixed(1)}</span>
              </div>
              <input type="range" min="1" max="15" step="0.5" value={smoothSpeed} onChange={(e) => setSmoothSpeed(+e.target.value)} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>BASE STIFFNESS (K)</span>
                <span style={{ color: "#4ade80" }}>{baseStiffness} Nm/rad</span>
              </div>
              <input type="range" min="40" max="280" step="5" value={baseStiffness} onChange={(e) => setBaseStiffness(+e.target.value)} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>BASE DAMPING (B)</span>
                <span style={{ color: "#a855f7" }}>{baseDamping} Nms/rad</span>
              </div>
              <input type="range" min="2" max="35" step="1" value={baseDamping} onChange={(e) => setBaseDamping(+e.target.value)} />
            </div>
          </div>

          <div style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}>
            <strong style={{ color: "#38bdf8" }}>LIVE CONTROL PIPELINE:</strong><br />
            1. Dual MUAP Spike Trains (1000 Hz) ? 20-450 Hz Bandpass ? RMS Window<br />
            2. Hill-Type MTU Dynamics: f_l(?) & f_v(v) ? Net Biological Torque<br />
            3. Adaptive Cross-Talk Cancellation Matrix + Variable Impedance FSM<br />
            4. Stability Margin Verification: ICR vs GRF Line of Action
          </div>
        </div>

        {/* RIGHT COLUMN: Telemetry, Oscilloscope, Spectrum & Logger */}
        <div style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "rgba(10, 14, 23, 0.5)",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
            HIGH-SPEED TELEMETRY & RESEARCH SUITE
          </div>

          <SignalOscilloscope
            rawQuadHistory={display.rawQuadHistory}
            filtQuadHistory={display.filtQuadHistory}
            rawHamHistory={display.rawHamHistory}
            filtHamHistory={display.filtHamHistory}
            quadRecruitment={display.bioState.quadActivation}
            hamRecruitment={display.bioState.hamActivation}
          />

          <SpectrumAndPhase
            fftSpectrum={display.fftSpectrum}
            medianFrequency={display.medianFreq}
            fatigueLevel={display.fatigueLevel}
            orbitHistory={display.orbitHistory}
            kneeAngle={display.kneeAngle}
            kneeVelocity={display.kneeVelocity}
          />

          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            padding: "12px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 180,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>
                CLINICAL RESEARCH LOG ({logEntries.length})
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={takeSnapshot}
                  className="btn"
                  style={{ padding: "4px 8px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid #38bdf8" }}
                >
                  ? SNAP
                </button>
                <button
                  onClick={exportCSV}
                  className="btn"
                  style={{ padding: "4px 8px", background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", border: "1px solid #4ade80" }}
                >
                  ? CSV
                </button>
                <button
                  onClick={exportJSON}
                  className="btn"
                  style={{ padding: "4px 8px", background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid #c084fc" }}
                >
                  ? JSON
                </button>
                <button
                  onClick={() => setLogEntries([])}
                  className="btn"
                  style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                >
                  ?
                </button>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, maxHeight: 160 }}>
              {logEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                  Click SNAP to capture synchronized kinematics, EMG & impedance data points
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>Time</th>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>Phase</th>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>Angle?</th>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>Q/H mV</th>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>K (Nm)</th>
                      <th style={{ textAlign: "left", padding: "3px 4px" }}>MDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map((e, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "3px 4px", color: "rgba(255,255,255,0.4)" }}>{e.t}</td>
                        <td style={{ padding: "3px 4px", color: "#38bdf8" }}>{e.phase.split(" ")[0]}</td>
                        <td style={{ padding: "3px 4px", color: "#4ade80" }}>{e.angle}?</td>
                        <td style={{ padding: "3px 4px", color: "#f59e0b" }}>{e.quadEMG}/{e.hamEMG}</td>
                        <td style={{ padding: "3px 4px", color: "#c084fc" }}>{e.stiffness}</td>
                        <td style={{ padding: "3px 4px", color: e.mdf < 80 ? "#ef4444" : "rgba(255,255,255,0.6)" }}>{e.mdf} Hz</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <CalibrationModal
        isOpen={calibOpen}
        onClose={() => setCalibOpen(false)}
        onApplyCalibration={(data) => {
          console.log("Calibration applied:", data);
        }}
        currentRawQuad={display.rawQuadHistory[display.rawQuadHistory.length - 1]}
        currentRawHam={display.rawHamHistory[display.rawHamHistory.length - 1]}
      />
    </div>
  );
}
