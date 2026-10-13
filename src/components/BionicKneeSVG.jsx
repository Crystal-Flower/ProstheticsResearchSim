import React from "react";

export default function BionicKneeSVG({
  angle = 15,
  stiffness = 150,
  damping = 12,
  torque = 0,
  stumbleActive = false,
  gaitPhase = { name: "Mid-Stance", color: "#4ade80" },
  groundReactionForce = 680,
}) {
  const angleRad = (angle * Math.PI) / 180;
  const femurAngle = -angle * 0.35;
  const tibiaAngle = angle * 0.75;

  const pistonStroke = Math.min(85, 32 + angle * 0.72);
  const fluidGlow = stumbleActive
    ? "rgba(239, 68, 68, 0.85)"
    : damping > 25
    ? "rgba(245, 158, 11, 0.7)"
    : "rgba(56, 189, 248, 0.4)";

  const isStable = angle < 38 && !stumbleActive;
  const grfVectorColor = isStable ? "#4ade80" : "#f43f5e";
  const grfOriginX = 135 + Math.sin((tibiaAngle * Math.PI) / 180) * 110;
  const grfOriginY = 360;
  const grfTargetX = isStable ? 122 : 162;
  const grfTargetY = 160;

  return (
    <svg viewBox="0 0 320 440" className="bionic-knee-svg" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="carbonWeave" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#181a20" />
          <path d="M0 0 L6 6 M6 0 L0 6" stroke="#262a33" strokeWidth="1.2" />
        </pattern>

        <linearGradient id="titaniumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="30%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        <filter id="bionicGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="icrGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={grfVectorColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={grfVectorColor} stopOpacity="0.0" />
        </radialGradient>
      </defs>

      {/* Background grid markings */}
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="1">
        <line x1="40" y1="0" x2="40" y2="440" />
        <line x1="160" y1="0" x2="160" y2="440" strokeDasharray="4,4" stroke="rgba(255,255,255,0.08)" />
        <line x1="280" y1="0" x2="280" y2="440" />
        <line x1="0" y1="190" x2="320" y2="190" strokeDasharray="4,4" stroke="rgba(255,255,255,0.08)" />
      </g>

      {/* Ground surface and Reaction Force */}
      <g>
        <line x1="20" y1="390" x2="300" y2="390" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        {[40, 70, 100, 130, 160, 190, 220, 250, 280].map(x => (
          <line key={x} x1={x} y1="390" x2={x - 12} y2="402" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        ))}

        {/* Dynamic Ground Reaction Force (GRF) Vector */}
        {groundReactionForce > 50 && (
          <g filter="url(#bionicGlow)">
            <line
              x1={grfOriginX}
              y1={grfOriginY}
              x2={grfTargetX}
              y2={grfTargetY}
              stroke={grfVectorColor}
              strokeWidth="2.5"
              strokeDasharray={stumbleActive ? "5,3" : "none"}
            />
            <polygon
              points="0,-6 4,4 -4,4"
              fill={grfVectorColor}
              transform={`translate(${grfTargetX}, ${grfTargetY}) rotate(${Math.atan2(grfTargetX - grfOriginX, grfOriginY - grfTargetY) * 180 / Math.PI})`}
            />
            <text
              x={grfOriginX + 10}
              y={(grfOriginY + grfTargetY) / 2}
              fill={grfVectorColor}
              fontSize="9"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
            >
              GRF: {groundReactionForce.toFixed(0)} N
            </text>
          </g>
        )}
      </g>

      {/* Proximal Socket and Residual Femur */}
      <g transform={`translate(160, 190) rotate(${femurAngle})`}>
        {/* Residual femur bone */}
        <path
          d="M -12 -155 L 12 -155 L 10 -40 C 10 -25 -10 -25 -10 -40 Z"
          fill="#e2d9c2"
          opacity="0.6"
        />
        <text x="-25" y="-110" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">
          RESIDUAL FEMUR
        </text>

        {/* Silicone suspension liner */}
        <path
          d="M -20 -150 L 20 -150 L 16 -30 C 16 -18 -16 -18 -16 -30 Z"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          opacity="0.4"
        />

        {/* Carbon-fiber socket frame */}
        <path
          d="M -28 -160 L 28 -160 L 22 -20 C 22 -5 -22 -5 -22 -20 Z"
          fill="url(#carbonWeave)"
          stroke="#475569"
          strokeWidth="2"
        />

        {/* Proximal pyramid adapter */}
        <rect x="-16" y="-18" width="32" height="14" rx="3" fill="url(#titaniumGrad)" stroke="#94a3b8" strokeWidth="1" />
        <polygon points="-8,-4 8,-4 5,8 -5,8" fill="#64748b" />
      </g>

      {/* Distal Shank and Bionic Actuator */}
      <g transform={`translate(160, 190) rotate(${tibiaAngle})`}>
        {/* Smart MR Actuator Piston */}
        <g transform="translate(18, 10)">
          {/* Cylinder Housing */}
          <rect x="-9" y="20" width="18" height="95" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          
          {/* Fluid Chamber Glow */}
          <rect
            x="-6"
            y="30"
            width="12"
            height="75"
            rx="2"
            fill={fluidGlow}
            filter="url(#bionicGlow)"
          />

          {/* Magnetic field coils */}
          {[38, 50, 62, 74, 86].map(cy => (
            <line key={cy} x1="-9" y1={cy} x2="9" y2={cy} stroke="#334155" strokeWidth="1.5" />
          ))}

          {/* Moving Chrome Piston Rod */}
          <rect
            x="-4"
            y={20 - pistonStroke * 0.4}
            width="8"
            height={pistonStroke}
            rx="2"
            fill="url(#chromeGrad)"
            stroke="#94a3b8"
            strokeWidth="1"
          />

          <circle cx="0" cy={20 - pistonStroke * 0.4} r="5" fill="#cbd5e1" stroke="#334155" strokeWidth="1.5" />
        </g>

        {/* Polycentric 4-Bar Linkage Chassis */}
        <path
          d="M -15,8 L 15,8 L 22,125 L -10,125 Z"
          fill="url(#titaniumGrad)"
          stroke="#64748b"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* Pylon Tube */}
        <rect x="-7" y="125" width="14" height="95" rx="3" fill="url(#carbonWeave)" stroke="#334155" strokeWidth="1" />

        {/* Bionic Carbon Fiber Foot */}
        <path
          d="M -15,220 C -22,220 -28,210 -25,195 C -20,215 15,215 45,215 C 65,215 80,210 75,200 C 72,215 45,225 15,225 Z"
          fill="url(#carbonWeave)"
          stroke="#64748b"
          strokeWidth="2"
        />
        <ellipse cx="-20" cy="210" rx="6" ry="8" fill="#38bdf8" opacity="0.5" />
        <circle cx="55" cy="214" r="4" fill="#4ade80" opacity="0.8" />

        {/* Microprocessor Hub */}
        <rect x="-16" y="45" width="14" height="28" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
        <circle cx="-9" cy="52" r="2" fill="#38bdf8" />
        <circle cx="-9" cy="60" r="2" fill={stumbleActive ? "#ef4444" : "#4ade80"} />
      </g>

      {/* Knee Instantaneous Center of Rotation (ICR) */}
      <g transform="translate(160, 190)">
        <circle cx="0" cy="0" r="16" fill="url(#icrGlow)" />
        <circle cx="0" cy="0" r="8" fill="#0f172a" stroke={grfVectorColor} strokeWidth="2" />
        <circle cx="0" cy="0" r="3" fill={grfVectorColor} />

        {/* Angle Arc Indicator */}
        <path
          d={`M 0,-32 A 32 32 0 ${angle > 180 ? 1 : 0} 1 ${32 * Math.sin((angle * Math.PI) / 180)} ${-32 * Math.cos((angle * Math.PI) / 180)}`}
          fill="none"
          stroke={grfVectorColor}
          strokeWidth="2"
        />
        <text
          x="24"
          y="-28"
          fill={grfVectorColor}
          fontSize="12"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
        >
          {angle.toFixed(1)}?
        </text>
      </g>

      {/* Emergency Fall-Prevention Reflex Banner */}
      {stumbleActive && (
        <g transform="translate(30, 24)" filter="url(#bionicGlow)">
          <rect x="0" y="0" width="260" height="34" rx="6" fill="rgba(239, 68, 68, 0.95)" stroke="#fee2e2" strokeWidth="1.5" />
          <text x="130" y="18" fill="#ffffff" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700" textAnchor="middle">
            ?? STUMBLE DETECTED ? REFLEX LOCK
          </text>
          <text x="130" y="29" fill="#fee2e2" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
            HYDRAULIC VALVE CLAMPED: 90 N?m?s/rad
          </text>
        </g>
      )}

      {/* Stability Badge */}
      <g transform="translate(16, 405)">
        <rect x="0" y="0" width="135" height="24" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <circle cx="12" cy="12" r="4" fill={isStable ? "#4ade80" : "#f43f5e"} />
        <text x="24" y="15" fill="#e2e8f0" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          {isStable ? "STABLE MARGIN (+)" : "BUCKLE HAZARD (-)"}
        </text>
      </g>
    </svg>
  );
}
