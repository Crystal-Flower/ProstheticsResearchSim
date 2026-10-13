import React from "react";

export default function AnatomyKneeSVG({
  angle = 15,
  quadActivation = 0.4,
  hamActivation = 0.2,
  quadForce = 450,
  hamForce = 180,
  coContraction = 0.2,
}) {
  const femurAngle = -angle * 0.35;
  const tibiaAngle = angle * 0.75;

  // Muscle color glows
  const quadAlpha = 0.25 + quadActivation * 0.7;
  const hamAlpha = 0.2 + hamActivation * 0.65;
  const quadColor = `rgba(239, 68, 68, ${quadAlpha})`;
  const hamColor = `rgba(59, 130, 246, ${hamAlpha})`;

  // Ligament strain: as knee flexes, cruciate ligaments stretch and change hue
  const aclStrain = Math.min(1.0, 0.2 + (angle / 90) * 0.8);
  const pclStrain = Math.min(1.0, 0.3 + (angle / 90) * 0.6);
  const aclColor = aclStrain > 0.75 ? "#f59e0b" : "#38bdf8";
  const pclColor = pclStrain > 0.7 ? "#ec4899" : "#a855f7";

  return (
    <svg viewBox="0 0 320 440" className="anatomy-knee-svg" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <radialGradient id="boneGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fdf8e6" />
          <stop offset="60%" stopColor="#e8d5b5" />
          <stop offset="100%" stopColor="#bfa37c" />
        </radialGradient>

        <linearGradient id="cartilageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b8e0f0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#67b0d1" stopOpacity="0.75" />
        </linearGradient>

        <linearGradient id="quadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f87171" stopOpacity={0.4 + quadActivation * 0.55} />
          <stop offset="50%" stopColor="#dc2626" stopOpacity={0.6 + quadActivation * 0.35} />
          <stop offset="100%" stopColor="#991b1b" stopOpacity={0.8} />
        </linearGradient>

        <linearGradient id="hamGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35 + hamActivation * 0.55} />
          <stop offset="50%" stopColor="#2563eb" stopOpacity={0.55 + hamActivation * 0.35} />
          <stop offset="100%" stopColor="#1e40af" stopOpacity={0.75} />
        </linearGradient>

        <filter id="muscleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid background */}
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="1">
        <line x1="160" y1="0" x2="160" y2="440" strokeDasharray="4,4" />
        <line x1="0" y1="200" x2="320" y2="200" strokeDasharray="4,4" />
      </g>

      {/* ?? PROXIMAL: FEMUR AND QUADRICEPS ?? */}
      <g transform={`translate(160, 200) rotate(${femurAngle})`}>
        {/* Quadriceps Muscle Belly */}
        <g filter="url(#muscleGlow)">
          <path
            d="M -32 -180 C -45 -130 -42 -60 -22 -35 C -15 -45 -20 -120 -20 -180 Z"
            fill="url(#quadGrad)"
          />
          {/* Muscle fiber striations */}
          {[-150, -125, -100, -75, -50].map((y) => (
            <line key={y} x1="-36" y1={y} x2="-22" y2={y + 12} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          ))}
          <text x="-48" y="-100" fill="#f87171" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
            QUAD: {quadForce.toFixed(0)} N
          </text>
        </g>

        {/* Femur Shaft */}
        <rect x="-14" y="-180" width="28" height="165" rx="8" fill="url(#boneGrad)" stroke="#ab8e66" strokeWidth="1.5" />

        {/* Femoral Condyles */}
        <ellipse cx="0" cy="-12" rx="36" ry="22" fill="url(#boneGrad)" stroke="#ab8e66" strokeWidth="1" />
        <ellipse cx="-18" cy="-8" rx="18" ry="16" fill="url(#boneGrad)" />
        <ellipse cx="18" cy="-8" rx="18" ry="16" fill="url(#boneGrad)" />

        {/* Articular Cartilage on Femur */}
        <ellipse cx="0" cy="-2" rx="32" ry="8" fill="url(#cartilageGrad)" />

        {/* Patella (Knee Cap) */}
        <ellipse cx="-4" cy="-28" rx="15" ry="17" fill="url(#boneGrad)" stroke="#ab8e66" strokeWidth="1.5" />
        <ellipse cx="-4" cy="-28" rx="9" ry="11" fill="#fff9eb" opacity="0.6" />
      </g>

      {/* ?? DISTAL: TIBIA, FIBULA, AND HAMSTRINGS ?? */}
      <g transform={`translate(160, 200) rotate(${tibiaAngle})`}>
        {/* Hamstrings Muscle Belly */}
        <g filter="url(#muscleGlow)">
          <path
            d="M 28 30 C 44 80 40 150 24 190 C 18 175 22 100 20 30 Z"
            fill="url(#hamGrad)"
          />
          {[50, 75, 100, 125, 150].map((y) => (
            <line key={y} x1="22" y1={y} x2="36" y2={y + 12} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          ))}
          <text x="36" y="110" fill="#60a5fa" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
            HAM: {hamForce.toFixed(0)} N
          </text>
        </g>

        {/* Tibial Plateau Cartilage */}
        <ellipse cx="0" cy="8" rx="30" ry="10" fill="url(#cartilageGrad)" />

        {/* Medial and Lateral Menisci */}
        <path d="M -30,9 Q -15,18 -2,12 Q -15,5 -30,9 Z" fill="#b0d6eb" opacity="0.9" />
        <path d="M 30,9 Q 15,18 2,12 Q 15,5 30,9 Z" fill="#b0d6eb" opacity="0.9" />

        {/* Tibia Bone Shaft */}
        <rect x="-13" y="14" width="26" height="180" rx="7" fill="url(#boneGrad)" stroke="#ab8e66" strokeWidth="1.5" />
        <ellipse cx="0" cy="16" rx="34" ry="13" fill="url(#boneGrad)" stroke="#ab8e66" strokeWidth="1" />

        {/* Fibula Bone */}
        <rect x="20" y="32" width="11" height="150" rx="5" fill="#d8c199" stroke="#ab8e66" strokeWidth="1" opacity="0.85" />

        {/* Patellar Tendon */}
        <path
          d="M -10,-24 Q -6,14 -8,26 M 6,-24 Q 4,14 2,26"
          stroke="#fde047"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          transform={`translate(0, ${-tibiaAngle * 0.25 + femurAngle * 0.2})`}
        />
      </g>

      {/* ?? CRUCIATE LIGAMENTS (ACL and PCL) ?? */}
      <g transform="translate(160, 200)">
        {/* Anterior Cruciate Ligament (ACL) */}
        <line
          x1="-10"
          y1="-4"
          x2="14"
          y2="14"
          stroke={aclColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.85 + aclStrain * 0.15}
        />
        {/* Posterior Cruciate Ligament (PCL) */}
        <line
          x1="12"
          y1="-6"
          x2="-10"
          y2="14"
          stroke={pclColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.85 + pclStrain * 0.15}
        />

        {/* Joint Center Pivot */}
        <circle cx="0" cy="0" r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
      </g>

      {/* Co-contraction indicator */}
      <g transform="translate(20, 395)">
        <rect x="0" y="0" width="140" height="28" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="10" y="14" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">
          CO-CONTRACTION
        </text>
        <rect x="10" y="18" width="120" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
        <rect x="10" y="18" width={Math.min(120, coContraction * 120)} height="4" rx="2" fill="#38bdf8" />
      </g>
    </svg>
  );
}
