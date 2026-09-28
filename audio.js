/**
 * Procedural Audio Synthesizer for UTM Lab (Web Audio API)
 * Generates realistic machine hydraulics, platen impact, acoustic emission, fracture snaps, and UI feedback.
 */

class LabAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.6;
    this.masterGain = null;

    // Pump sound nodes
    this.pumpOsc = null;
    this.pumpSubOsc = null;
    this.pumpFilter = null;
    this.pumpGain = null;
    this.isPumpRunning = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // Start continuous hydraulic pump hum
  startHydraulicPump() {
    this.ensureContext();
    if (!this.ctx || this.isPumpRunning) return;

    const t = this.ctx.currentTime;
    
    // Main motor tone
    this.pumpOsc = this.ctx.createOscillator();
    this.pumpOsc.type = 'sawtooth';
    this.pumpOsc.frequency.setValueAtTime(58, t); // 58 Hz industrial motor hum

    // Sub rumble tone
    this.pumpSubOsc = this.ctx.createOscillator();
    this.pumpSubOsc.type = 'sine';
    this.pumpSubOsc.frequency.setValueAtTime(29, t);

    // Low-pass filter for muffled hydraulic enclosure sound
    this.pumpFilter = this.ctx.createBiquadFilter();
    this.pumpFilter.type = 'lowpass';
    this.pumpFilter.frequency.setValueAtTime(160, t);
    this.pumpFilter.Q.setValueAtTime(3.0, t);

    // Pump gain
    this.pumpGain = this.ctx.createGain();
    this.pumpGain.gain.setValueAtTime(0.001, t);
    this.pumpGain.gain.exponentialRampToValueAtTime(0.25, t + 0.4);

    this.pumpOsc.connect(this.pumpFilter);
    this.pumpSubOsc.connect(this.pumpFilter);
    this.pumpFilter.connect(this.pumpGain);
    this.pumpGain.connect(this.masterGain);

    this.pumpOsc.start(t);
    this.pumpSubOsc.start(t);
    this.isPumpRunning = true;
  }

  // Modulate pump sound based on hydraulic pressure / load (0 to 1)
  updatePumpLoad(loadRatio) {
    if (!this.isPumpRunning || !this.ctx) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, loadRatio));
    
    // As load increases, frequency rises slightly and filter opens up
    const targetFreq = 58 + clamped * 24; // 58 to 82 Hz
    const targetCutoff = 160 + clamped * 350; // 160 to 510 Hz
    const targetGain = 0.25 + clamped * 0.15;

    this.pumpOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
    this.pumpFilter.frequency.setTargetAtTime(targetCutoff, t, 0.1);
    this.pumpGain.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  stopHydraulicPump() {
    if (!this.isPumpRunning || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    if (this.pumpGain) {
      this.pumpGain.gain.setValueAtTime(this.pumpGain.gain.value, t);
      this.pumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    }
    
    setTimeout(() => {
      if (this.pumpOsc) {
        try { this.pumpOsc.stop(); this.pumpOsc.disconnect(); } catch (e) {}
      }
      if (this.pumpSubOsc) {
        try { this.pumpSubOsc.stop(); this.pumpSubOsc.disconnect(); } catch (e) {}
      }
      this.isPumpRunning = false;
    }, 550);
  }

  // Metallic platen contact click
  playPlatenContact() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Sharp, explosive brittle fracture snap (Cast Iron shear split)
  playBrittleFracture() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Noise burst (shatter crack)
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 2. Heavy mechanical transient boom
    const boomOsc = this.ctx.createOscillator();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(180, t);
    boomOsc.frequency.exponentialRampToValueAtTime(35, t + 0.25);

    const boomGain = this.ctx.createGain();
    boomGain.gain.setValueAtTime(0.9, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    boomOsc.connect(boomGain);
    boomGain.connect(this.masterGain);

    // 3. Metallic ring chime decay
    const ringOsc = this.ctx.createOscillator();
    ringOsc.type = 'triangle';
    ringOsc.frequency.setValueAtTime(2450, t);
    ringOsc.frequency.exponentialRampToValueAtTime(1800, t + 0.4);

    const ringGain = this.ctx.createGain();
    ringGain.gain.setValueAtTime(0.3, t);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    ringOsc.connect(ringGain);
    ringGain.connect(this.masterGain);

    noiseSource.start(t);
    boomOsc.start(t);
    ringOsc.start(t);

    noiseSource.stop(t + 0.4);
    boomOsc.stop(t + 0.35);
    ringOsc.stop(t + 0.5);
  }

  // Concrete crushing / spalling sound
  playConcreteCrush() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Granular crackles
      const crackle = (Math.random() > 0.96 ? 1 : 0) * (Math.random() * 2 - 1);
      data[i] = ((Math.random() * 2 - 1) * 0.4 + crackle * 0.6) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, t);
    noiseFilter.Q.setValueAtTime(1.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.6);
  }

  // Yielding groan / creak
  playYieldCreak() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(310, t);
    osc.frequency.linearRampToValueAtTime(220, t + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.setValueAtTime(6.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.32);
  }

  // Vernier caliper sliding metallic rasp
  playCaliperSlide() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(t);
    src.stop(t + 0.09);
  }

  // Button click / UI sound
  playClick() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Safety confirmation green-light chime
  playSafetySuccess() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const playTone = (freq, startOffset, dur) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + startOffset);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.2, t + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + startOffset + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + startOffset);
      osc.stop(t + startOffset + dur);
    };

    playTone(523.25, 0.0, 0.15); // C5
    playTone(659.25, 0.08, 0.15); // E5
    playTone(783.99, 0.16, 0.3); // G5
  }

  // Emergency stop or alert alarm
  playAlert() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(440, t + 0.15);
    osc.frequency.setValueAtTime(880, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }
}

export const sound = new LabAudioEngine();
