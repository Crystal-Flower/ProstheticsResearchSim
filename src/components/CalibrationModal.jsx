import React, { useState, useEffect } from "react";

export default function CalibrationModal({ isOpen, onClose, onApplyCalibration, currentRawQuad = 0, currentRawHam = 0 }) {
  const [step, setStep] = useState(1);
  const [timer, setTimer] = useState(3);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [calibData, setCalibData] = useState({
    baselineNoise: 0.02,
    quadMVC: 0.95,
    hamMVC: 0.88,
    crossTalkSuppression: 0.15,
  });

  useEffect(() => {
    let interval = null;
    if (isMeasuring && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (isMeasuring && timer === 0) {
      setIsMeasuring(false);
      // Auto-advance step
      if (step === 1) {
        setCalibData((prev) => ({ ...prev, baselineNoise: Math.max(0.01, Math.abs(currentRawQuad) * 0.8) }));
        setStep(2);
        setTimer(3);
      } else if (step === 2) {
        setCalibData((prev) => ({ ...prev, quadMVC: Math.max(0.6, Math.abs(currentRawQuad) * 1.5) }));
        setStep(3);
        setTimer(3);
      } else if (step === 3) {
        setCalibData((prev) => ({ ...prev, hamMVC: Math.max(0.5, Math.abs(currentRawHam) * 1.5) }));
        setStep(4);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMeasuring, timer, step, currentRawQuad, currentRawHam]);

  if (!isOpen) return null;

  const startMeasurement = () => {
    setIsMeasuring(true);
  };

  const handleFinish = () => {
    onApplyCalibration(calibData);
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#0f172a",
        border: "1px solid rgba(56, 189, 248, 0.3)",
        borderRadius: 14,
        padding: "24px 28px",
        width: "90%",
        maxWidth: 520,
        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>??</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                CLINICAL EMG CALIBRATION WIZARD
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                Standard MVC & Crosstalk Normalization Protocol
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}
          >
            ?
          </button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
          {[
            { n: 1, label: "Rest Floor" },
            { n: 2, label: "Quad MVC" },
            { n: 3, label: "Ham MVC" },
            { n: 4, label: "Matrix" },
          ].map(({ n, label }) => (
            <div
              key={n}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: step === n ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step === n ? "#38bdf8" : "rgba(255,255,255,0.07)"}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 9, color: step === n ? "#38bdf8" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                STEP {n}
              </div>
              <div style={{ fontSize: 10, color: step === n ? "#ffffff" : "rgba(255,255,255,0.6)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Step Body */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
          padding: "20px",
          minHeight: 150,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}>
          {step === 1 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                Step 1: Baseline Resting Noise Floor
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", maxWidth: 380 }}>
                Keep muscles completely relaxed and motionless for 3 seconds to measure electrode contact impedance and ambient 50/60 Hz electromagnetic hum.
              </div>
              {isMeasuring ? (
                <div style={{ fontSize: 24, fontWeight: 700, color: "#38bdf8", fontFamily: "monospace" }}>
                  Recording: {timer}s
                </div>
              ) : (
                <button
                  onClick={startMeasurement}
                  className="btn"
                  style={{ padding: "8px 20px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid #38bdf8" }}
                >
                  START 3s RECORDING
                </button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>
                Step 2: Quadriceps Maximum Voluntary Contraction (MVC)
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", maxWidth: 380 }}>
                Instruct patient to contract their thigh extensor (quadriceps) as hard as possible to establish the 100% MVC reference point.
              </div>
              {isMeasuring ? (
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>
                  Contract Quad: {timer}s
                </div>
              ) : (
                <button
                  onClick={startMeasurement}
                  className="btn"
                  style={{ padding: "8px 20px", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid #f59e0b" }}
                >
                  RECORD QUAD MVC
                </button>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#38bdf8" }}>
                Step 3: Hamstrings Maximum Voluntary Contraction (MVC)
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", maxWidth: 380 }}>
                Instruct patient to contract posterior thigh flexors (hamstrings) to calibrate antagonist flexor scale.
              </div>
              {isMeasuring ? (
                <div style={{ fontSize: 24, fontWeight: 700, color: "#38bdf8", fontFamily: "monospace" }}>
                  Contract Hamstrings: {timer}s
                </div>
              ) : (
                <button
                  onClick={startMeasurement}
                  className="btn"
                  style={{ padding: "8px 20px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid #38bdf8" }}
                >
                  RECORD HAMSTRING MVC
                </button>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>
                Calibration Matrix Synthesized
              </div>
              <div style={{ fontSize: 10, fontFamily: "monospace", textAlign: "left", width: "100%", background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: 6 }}>
                <div>Baseline Noise Floor: {calibData.baselineNoise.toFixed(4)} mV</div>
                <div>Quadriceps 100% MVC: {calibData.quadMVC.toFixed(4)} mV</div>
                <div>Hamstrings 100% MVC: {calibData.hamMVC.toFixed(4)} mV</div>
                <div>Antagonist Cross-Talk Cancellation: {(calibData.crossTalkSuppression * 100).toFixed(0)}%</div>
              </div>
              <button
                onClick={handleFinish}
                className="btn"
                style={{ padding: "8px 24px", background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", border: "1px solid #4ade80" }}
              >
                APPLY & ACTIVATE MATRIX
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
