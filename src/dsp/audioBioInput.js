// ─── Web Audio API Bio-Signal Ingestion ─────────────────────────────────────
// Converts real-time acoustic/microphone input into biological excitation signals.

export class AudioBioInput {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.micStream = null;
    this.dataArray = null;
    this.isActive = false;
  }

  async start() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone mediaDevices API not available');
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.6;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isActive = true;
      return true;
    } catch (err) {
      console.warn('Microphone access unavailable or denied:', err);
      this.isActive = false;
      return false;
    }
  }

  stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isActive = false;
  }

  getRecruitment() {
    if (!this.isActive || !this.analyser) {
      return { quadSignal: 0, hamSignal: 0 };
    }
    this.analyser.getByteFrequencyData(this.dataArray);

    // Split frequency spectrum into Low (Hamstrings) and High (Quadriceps)
    let lowSum = 0;
    let highSum = 0;
    const midPoint = Math.floor(this.dataArray.length / 3);

    for (let i = 0; i < midPoint; i++) {
      lowSum += this.dataArray[i];
    }
    for (let i = midPoint; i < this.dataArray.length; i++) {
      highSum += this.dataArray[i];
    }

    const hamSignal = Math.min(1.0, (lowSum / midPoint / 255) * 1.6);
    const quadSignal = Math.min(1.0, (highSum / (this.dataArray.length - midPoint) / 255) * 1.8);

    return { quadSignal, hamSignal };
  }
}
