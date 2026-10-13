// ─── Biomechanical & Gait Physics Engine ────────────────────────────────────
// Multi-muscle agonist/antagonist mechanics, 5-phase gait cycle,
// joint impedance, stability margin, and stumble reflex.

export const GAIT_PHASES = [
  { id: 'loading', name: 'Loading Response', range: [0.00, 0.15], color: '#38bdf8', desc: 'Shock absorption (0°-15° controlled yield)' },
  { id: 'mid_stance', name: 'Mid-Stance', range: [0.15, 0.40], color: '#4ade80', desc: 'Weight bearing (high stiffness lock)' },
  { id: 'terminal_stance', name: 'Terminal Stance', range: [0.40, 0.60], color: '#fbbf24', desc: 'Forefoot rollover and push-off return' },
  { id: 'initial_swing', name: 'Initial Swing', range: [0.60, 0.85], color: '#a855f7', desc: 'Rapid knee flexion for toe clearance' },
  { id: 'terminal_swing', name: 'Terminal Swing', range: [0.85, 1.00], color: '#f43f5e', desc: 'Tibia deceleration before heel strike' },
];

export function getGaitPhase(gaitProgress) {
  const p = ((gaitProgress % 1) + 1) % 1;
  for (let phase of GAIT_PHASES) {
    if (p >= phase.range[0] && p < phase.range[1]) return phase;
  }
  return GAIT_PHASES[0];
}

// ─── Hill-Type Muscle Model ──────────────────────────────────────────────────
export class HillMuscleModel {
  constructor(name, maxIsometricForce, optimalFiberLength, tendonSlackLength) {
    this.name = name;
    this.F0 = maxIsometricForce; // Newtons
    this.l0 = optimalFiberLength; // meters
    this.lt0 = tendonSlackLength; // meters
    this.activation = 0.05;
    this.fiberLength = optimalFiberLength;
    this.fiberVelocity = 0;
  }

  updateActivation(neuralExcitation, dt, tauAct = 0.02, tauDeact = 0.05) {
    const u = Math.min(1, Math.max(0, neuralExcitation));
    const tau = u > this.activation ? tauAct : tauDeact;
    this.activation += (u - this.activation) * (dt / tau);
    return this.activation;
  }

  forceLength(lengthNorm) {
    const w = 0.45;
    return Math.exp(-Math.pow((lengthNorm - 1) / w, 2));
  }

  computeForce(kneeAngleDeg, momentArm, isExtensor) {
    const angleRad = (kneeAngleDeg * Math.PI) / 180;
    const deltaLength = (isExtensor ? -1 : 1) * angleRad * momentArm;
    this.fiberLength = Math.max(this.l0 * 0.5, this.l0 + deltaLength);
    const lengthNorm = this.fiberLength / this.l0;
    const fl = this.forceLength(lengthNorm);
    const passiveForceNorm = lengthNorm > 1.0 ? Math.pow(lengthNorm - 1, 2) * 4.0 : 0;
    const totalNormForce = this.activation * fl + passiveForceNorm;
    return Math.max(0, totalNormForce * this.F0);
  }
}

// ─── Biomechanical Leg Simulation State ──────────────────────────────────────
export class BiomechanicalLeg {
  constructor() {
    this.quad = new HillMuscleModel('Quadriceps', 3400, 0.085, 0.22);
    this.ham = new HillMuscleModel('Hamstrings', 1900, 0.105, 0.32);
    this.quadMomentArm = 0.045; // m
    this.hamMomentArm = 0.038; // m

    this.kneeAngle = 6; // degrees
    this.kneeVelocity = 0; // deg/s
    this.stumbleActive = false;
    this.stumbleTimer = 0;
    this.stumbleDuration = 0.75;
    this.stumbleReflexTriggered = false;
    this.gaitCycleTime = 0;
  }

  triggerStumble() {
    this.stumbleActive = true;
    this.stumbleTimer = this.stumbleDuration;
    this.stumbleReflexTriggered = true;
  }

  update(dt, quadExcitation, hamExcitation) {
    this.gaitCycleTime += dt;

    // Muscle activation dynamics
    const qAct = this.quad.updateActivation(quadExcitation, dt);
    const hAct = this.ham.updateActivation(hamExcitation, dt);

    // Muscle forces (Newtons)
    const qForce = this.quad.computeForce(this.kneeAngle, this.quadMomentArm, true);
    const hForce = this.ham.computeForce(this.kneeAngle, this.hamMomentArm, false);

    // Moments (Nm)
    const extensorTorque = qForce * this.quadMomentArm;
    const flexorTorque = hForce * this.hamMomentArm;
    const netBiologicalTorque = flexorTorque - extensorTorque; // positive = flexes knee

    // Stumble timer & reflex
    if (this.stumbleActive) {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.stumbleActive = false;
        this.stumbleReflexTriggered = false;
      } else {
        this.stumbleReflexTriggered = true;
      }
    }

    const coContraction = Math.min(qAct, hAct) * 2;

    return {
      quadActivation: qAct,
      hamActivation: hAct,
      quadForce: qForce,
      hamForce: hForce,
      extensorTorque,
      flexorTorque,
      netBiologicalTorque,
      coContraction,
      stumbleReflexTriggered: this.stumbleReflexTriggered,
      stumbleActive: this.stumbleActive,
    };
  }
}
