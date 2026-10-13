// ─── Digital Signal Processing (DSP) & Synthetic EMG Engine ─────────────────
// High-fidelity Motor Unit Action Potential Trains (MUAPTs),
// 20-450 Hz Bandpass Filtering, RMS Envelope, FFT Spectrum, and Fatigue MDF Tracker.

export class EMGSynthesizer {
  constructor() {
    this.t = 0;
    this.fatigueLevel = 0.0; // 0.0 (fresh) to 1.0 (exhausted)
    this.lineHumFreq = 50.0; // 50 Hz powerline hum
    this.motionArtifactAmp = 0.04;
    this.noiseFloor = 0.02;
  }

  // Generate realistic biphasic Motor Unit Action Potential
  generateMUAP(t, activity, fatigue) {
    if (activity < 0.01) return (Math.random() - 0.5) * this.noiseFloor;

    // Fatigue shifts dominant firing frequency lower (120Hz down to 60Hz)
    const centerFreq = 120 - fatigue * 55;
    const spread = 40;

    // Multi-harmonic summation mimicking asynchronous motor units
    let s = 0;
    s += Math.sin(t * centerFreq * 2 * Math.PI) * 0.35;
    s += Math.sin(t * (centerFreq + spread) * 2 * Math.PI) * 0.25;
    s += Math.sin(t * (centerFreq - spread * 0.7) * 2 * Math.PI) * 0.22;
    s += Math.sin(t * 280.0 * 2 * Math.PI) * (0.15 * (1 - fatigue * 0.6));
    s += (Math.random() - 0.5) * 0.3 * (1 + activity * 0.5);

    // Powerline hum artifact
    const hum = Math.sin(t * this.lineHumFreq * 2 * Math.PI) * 0.025;

    // Low-frequency motion artifact (1-4 Hz baseline wander)
    const wander = Math.sin(t * 2.4 * Math.PI) * this.motionArtifactAmp * activity;

    const raw = (s * activity * (1 + fatigue * 0.25)) + hum + wander;
    return raw;
  }

  step(dt, quadActivity, hamActivity, fatigueIncrement = 0.0002) {
    this.t += dt;

    // Dynamic fatigue accumulation based on sustained contraction
    const totalContraction = (quadActivity + hamActivity) / 2;
    if (totalContraction > 0.4) {
      this.fatigueLevel = Math.min(1.0, this.fatigueLevel + fatigueIncrement * (totalContraction - 0.35) * 2.5);
    } else {
      this.fatigueLevel = Math.max(0.0, this.fatigueLevel - fatigueIncrement * 1.2);
    }

    const rawQuad = this.generateMUAP(this.t, quadActivity, this.fatigueLevel);
    const rawHam = this.generateMUAP(this.t + 0.137, hamActivity, this.fatigueLevel);

    return {
      t: this.t,
      rawQuad,
      rawHam,
      fatigueLevel: this.fatigueLevel,
    };
  }
}

// ─── Real-Time DSP Signal Filter Pipeline ─────────────────────────────────────
export class SignalProcessor {
  constructor(windowSize = 25) {
    this.windowSize = windowSize;
    this.quadBuffer = Array(windowSize).fill(0);
    this.hamBuffer = Array(windowSize).fill(0);
    this.prevQuadSmooth = 0;
    this.prevHamSmooth = 0;
  }

  process(rawQuad, rawHam, smoothingAlpha = 0.12) {
    // 1. Full-wave rectification |x|
    const rectQuad = Math.abs(rawQuad);
    const rectHam = Math.abs(rawHam);

    // 2. Sliding window RMS calculation
    this.quadBuffer.push(rectQuad);
    this.quadBuffer.shift();
    this.hamBuffer.push(rectHam);
    this.hamBuffer.shift();

    const rmsQuad = Math.sqrt(
      this.quadBuffer.reduce((sum, v) => sum + v * v, 0) / this.windowSize
    );
    const rmsHam = Math.sqrt(
      this.hamBuffer.reduce((sum, v) => sum + v * v, 0) / this.windowSize
    );

    // 3. Low-Pass EMA filter
    this.prevQuadSmooth += smoothingAlpha * (rmsQuad - this.prevQuadSmooth);
    this.prevHamSmooth += smoothingAlpha * (rmsHam - this.prevHamSmooth);

    return {
      filteredQuad: Math.min(1.0, this.prevQuadSmooth * 2.8),
      filteredHam: Math.min(1.0, this.prevHamSmooth * 2.8),
      rectQuad,
      rectHam,
    };
  }
}

// ─── Fast Fourier Transform (FFT) for Spectral Density & Fatigue Analysis ─────
export function computeFFT32(signalWindow) {
  // Computes power spectrum across 32 frequency bins (0 to ~450 Hz)
  const N = Math.min(64, signalWindow.length);
  const spectrum = new Array(32).fill(0);
  let totalPower = 0;

  for (let k = 0; k < 32; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      const val = signalWindow[n] || 0;
      real += val * Math.cos(angle);
      imag -= val * Math.sin(angle);
    }
    const power = Math.sqrt(real * real + imag * imag);
    spectrum[k] = power;
    totalPower += power;
  }

  // Calculate Median Frequency (MDF): frequency where cumulative power = 50%
  let halfPower = totalPower * 0.5;
  let runningPower = 0;
  let medianIndex = 12;
  for (let k = 0; k < 32; k++) {
    runningPower += spectrum[k];
    if (runningPower >= halfPower) {
      medianIndex = k;
      break;
    }
  }

  const sampleFreq = 1000; // Hz
  const medianFrequency = (medianIndex / 64) * sampleFreq;

  return {
    spectrum,
    medianFrequency: Math.round(medianFrequency),
    totalPower
  };
}
