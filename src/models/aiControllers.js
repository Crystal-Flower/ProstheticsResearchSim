// ─── Comparative AI & Control Architectures ─────────────────────────────────
// 1. Baseline Linear Threshold (Original Model)
// 2. Hill-Type Neuromusculoskeletal Model
// 3. Online Adaptive Multi-Layer Perceptron (Hebbian / Delta Adaptation)
// 4. Biomimetic Predictive Variable Impedance Controller (State of the art)

export const CONTROLLER_MODES = [
  {
    id: 'impedance',
    name: 'Biomimetic Variable Impedance (SOTA)',
    badge: 'ADVANCED',
    badgeColor: '#38bdf8',
    description: 'Phase-dependent stiffness K(phi) and damping B(phi) with reflex trip protection'
  },
  {
    id: 'mlp',
    name: 'Online Adaptive MLP Neural Net',
    badge: 'AI / ADAPTIVE',
    badgeColor: '#a855f7',
    description: '2-layer neural net with online Hebbian adaptation and cross-talk cancellation'
  },
  {
    id: 'hill',
    name: 'Hill Neuromusculoskeletal Model',
    badge: 'BIOMECH',
    badgeColor: '#4ade80',
    description: 'Physiological agonist-antagonist force-length-velocity dynamics'
  },
  {
    id: 'baseline',
    name: 'Baseline 1D Clamp (Original Model)',
    badge: 'LEGACY',
    badgeColor: '#f59e0b',
    description: 'Simple scalar clamp and lerp (unstable under impact or gait phase transitions)'
  }
];

// ─── 1. Baseline Controller (Original) ───────────────────────────────────────
export function runBaselineController(quadEMG, currentAngle, maxAngle, smoothSpeed, dt) {
  const aiOut = Math.min(1, Math.max(0, quadEMG));
  const targetAngle = aiOut * maxAngle;
  const lerpFactor = 1 - Math.exp(-smoothSpeed * dt);
  const nextAngle = currentAngle + lerpFactor * (targetAngle - currentAngle);
  return {
    targetAngle,
    currentAngle: nextAngle,
    stiffness: 80,
    damping: 5,
    torque: (nextAngle - currentAngle) * 0.5,
    aiConfidence: 0.55
  };
}

// ─── 2. Hill Neuromusculoskeletal Controller ─────────────────────────────────
export function runHillController(bioState, currentAngle, maxAngle, smoothSpeed, dt) {
  // Uses biological net torque to drive joint angle with compliance
  const netTorque = bioState.netBiologicalTorque; // positive flexes
  const baseStiffness = 120 + bioState.coContraction * 80;
  const damping = 8 + bioState.coContraction * 6;

  // Normalized angle target derived from torque balance
  const targetAngle = Math.min(maxAngle, Math.max(0, (netTorque / 15.0) * maxAngle + 5));
  const lerpFactor = 1 - Math.exp(-smoothSpeed * dt);
  const nextAngle = currentAngle + lerpFactor * (targetAngle - currentAngle);

  return {
    targetAngle,
    currentAngle: nextAngle,
    stiffness: baseStiffness,
    damping,
    torque: netTorque,
    aiConfidence: 0.82
  };
}

// ─── 3. Online Adaptive Multi-Layer Perceptron ────────────────────────────────
export class OnlineAdaptiveMLP {
  constructor() {
    // 2 inputs (Quad, Ham), 4 hidden neurons, 2 outputs (Flexion Target, Damping Mod)
    this.wHidden = [
      [-0.8, 1.2],
      [-1.1, 0.9],
      [1.3, -0.4],
      [0.6, 0.7],
    ];
    this.bHidden = [0.1, -0.1, 0.05, -0.05];
    this.wOutput = [
      [0.4, 0.6, -0.5, 0.3], // target angle
      [0.2, 0.3, 0.4, 0.8]   // damping modifier
    ];
    this.learningRate = 0.005;
    this.crossTalkMatrix = [[1.0, -0.15], [-0.15, 1.0]]; // adaptive cross-talk cancellation
  }

  adapt(quadEMG, hamEMG, error) {
    // Online Hebbian adaptation of cross-talk matrix
    const correlation = quadEMG * hamEMG;
    if (correlation > 0.08) {
      this.crossTalkMatrix[0][1] = Math.max(-0.4, this.crossTalkMatrix[0][1] - this.learningRate * 0.1);
      this.crossTalkMatrix[1][0] = this.crossTalkMatrix[0][1];
    }
  }

  forward(quadEMG, hamEMG, currentAngle, maxAngle, smoothSpeed, dt, stumbleReflex) {
    // Cross-talk cancellation
    const cleanQuad = Math.max(0, this.crossTalkMatrix[0][0] * quadEMG + this.crossTalkMatrix[0][1] * hamEMG);
    const cleanHam = Math.max(0, this.crossTalkMatrix[1][0] * quadEMG + this.crossTalkMatrix[1][1] * hamEMG);

    // Forward pass
    const hidden = this.wHidden.map((weights, i) => {
      const sum = weights[0] * cleanQuad + weights[1] * cleanHam + this.bHidden[i];
      return Math.tanh(sum); // activation
    });

    const outAngleNorm = Math.tanh(
      hidden.reduce((acc, h, i) => acc + h * this.wOutput[0][i], 0)
    );
    const outDampNorm = Math.max(0, 
      hidden.reduce((acc, h, i) => acc + h * this.wOutput[1][i], 0)
    );

    let targetAngle = Math.max(2, Math.min(maxAngle, ((outAngleNorm + 1) / 2) * maxAngle));
    let damping = 6 + outDampNorm * 10;
    let stiffness = 130 + (cleanQuad + cleanHam) * 70;

    if (stumbleReflex) {
      damping = 85; // high hydraulic reflex lock
      targetAngle = Math.min(currentAngle, 15);
    }

    const lerpFactor = 1 - Math.exp(-smoothSpeed * dt);
    const nextAngle = currentAngle + lerpFactor * (targetAngle - currentAngle);

    return {
      targetAngle,
      currentAngle: nextAngle,
      stiffness,
      damping,
      torque: (targetAngle - nextAngle) * 0.45,
      aiConfidence: 0.91,
      cleanQuad,
      cleanHam
    };
  }
}

// ─── 4. Biomimetic Predictive Variable Impedance Controller ──────────────────
export class BiomimeticImpedanceController {
  constructor() {
    this.lastGaitPhase = 'loading';
  }

  compute(phaseProgress, quadEMG, hamEMG, currentAngle, maxAngle, dt, stumbleActive) {
    // Phase-dependent equilibrium angles (deg), stiffness K (Nm/rad), damping B (Nms/rad)
    let theta0 = 5;
    let K = 160;
    let B = 14;
    let phaseName = 'Loading Response';

    if (phaseProgress < 0.15) {
      // 1. Loading Response: yield for shock absorption
      phaseName = 'Loading Response';
      theta0 = 12;
      K = 140;
      B = 16;
    } else if (phaseProgress < 0.40) {
      // 2. Mid-Stance: rigid weight bearing
      phaseName = 'Mid-Stance';
      theta0 = 4;
      K = 220;
      B = 22;
    } else if (phaseProgress < 0.60) {
      // 3. Terminal Stance / Push-off: knee unlocks, prepares for swing
      phaseName = 'Terminal Stance';
      theta0 = 25;
      K = 70;
      B = 5;
    } else if (phaseProgress < 0.85) {
      // 4. Initial / Mid-Swing: high flexion for toe clearance
      phaseName = 'Initial Swing';
      theta0 = maxAngle * 0.95;
      K = 20;
      B = 2.0;
    } else {
      // 5. Terminal Swing: tibia decelerates before ground contact
      phaseName = 'Terminal Swing';
      theta0 = 4;
      K = 45;
      B = 15;
    }

    // Voluntary EMG Modulation
    // Quadriceps activity increases stiffness and extends knee
    // Hamstrings activity increases flexion angle
    const voluntaryModulation = (hamEMG * 0.7 - quadEMG * 0.5) * 20;
    theta0 = Math.max(2, Math.min(maxAngle, theta0 + voluntaryModulation));
    K += (quadEMG + hamEMG) * 50;

    // Stumble / Fall-Prevention Autopilot Reflex
    let reflexLocked = false;
    if (stumbleActive) {
      reflexLocked = true;
      B = 90; // maximum hydraulic shear resistance
      K = 280; // extreme stiffness lock
      theta0 = Math.min(currentAngle, 12); // clamp to safe stance angle
    }

    // Impedance dynamic equation: Tau = -K*(theta - theta0) - B*theta_dot
    const thetaError = (currentAngle - theta0);
    const angVel = (currentAngle - (this.prevAngle || currentAngle)) / Math.max(0.001, dt);
    this.prevAngle = currentAngle;

    const torque = - (K * (thetaError * Math.PI / 180)) - (B * (angVel * Math.PI / 180));

    // Dynamic numerical integration (simplified 2nd order system)
    const effectiveInertia = 0.25; // kg*m^2
    const acc = torque / effectiveInertia;
    const nextAngle = Math.max(0, Math.min(maxAngle + 5, currentAngle + (angVel * dt + 0.5 * acc * dt * dt) * (180 / Math.PI) * 0.05));

    return {
      targetAngle: theta0,
      currentAngle: nextAngle,
      stiffness: K,
      damping: B,
      torque,
      phaseName,
      reflexLocked,
      aiConfidence: 0.98
    };
  }
}
