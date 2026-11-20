export interface CoastalAudio {
  isMuted: boolean;
  isBgmEnabled: boolean;
  setMuted: (muted: boolean) => void;
  setBgmEnabled: (enabled: boolean) => void;
  unlockFromGesture: () => void;
  ringBell: () => void;
  dispose: () => void;
}

const NOTE_FREQS: Record<string, number> = {
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
};

// Traditional Jeju Folk Song: "Odolttogi" (오돌또기) + "Neoyeong Nayeong" (너영나영) bridge
// Format: [noteName | null, durationInBeats] in Semachi 3-beat feel
const JEJU_FOLK_SCORE: [string | null, number][] = [
  // "오-돌-또-기 저-기 춘-향 나-온-다~"
  ['G4', 2], ['A4', 1], ['C5', 2], ['C5', 1],
  ['D5', 2], ['E5', 1], ['D5', 2], ['C5', 1],
  ['A4', 2], ['G4', 1], ['A4', 3],
  // "달-도 밝-고 내-가 머-리 갈-까-나~"
  ['C5', 2], ['D5', 1], ['E5', 2], ['G5', 1],
  ['E5', 2], ['D5', 1], ['C5', 1.5], ['A4', 1.5], ['G4', 3],

  // "둥-그-대-당-실 둥-그-대-당-실 여-도-당-실 연-자 버-리-고"
  ['C5', 2], ['C5', 1], ['D5', 2], ['E5', 1],
  ['C5', 2], ['C5', 1], ['D5', 2], ['E5', 1],
  ['G5', 2], ['E5', 1], ['D5', 2], ['C5', 1],
  ['A4', 2], ['G4', 1], ['A4', 2], ['C5', 1],
  // "달-도 밝-고 내-가 머-리 갈-까-나~"
  ['D5', 2], ['E5', 1], ['D5', 2], ['C5', 1],
  ['A4', 1.5], ['G4', 1.5], ['G4', 3],

  // Gentle "너영나영" coastal interlude
  ['E5', 2], ['E5', 1], ['D5', 2], ['C5', 1],
  ['D5', 2], ['C5', 1], ['A4', 2], ['G4', 1],
  ['A4', 2], ['C5', 1], ['D5', 2], ['C5', 1],
  ['A4', 2], ['G4', 1], ['G4', 3],
];

export function createCoastalAudio(): CoastalAudio {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let bgmGain: GainNode | null = null;
  let bgmDelayIn: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let noiseSource: AudioBufferSourceNode | null = null;
  let lfoOsc: OscillatorNode | null = null;

  let isMuted = false;
  let isBgmEnabled = true;
  let userExplicitlyMuted = false;
  let schedulerTimer: number | null = null;
  let nextNoteTime = 0;
  let scoreIndex = 0;
  let beatAccumulator = 0;
  let disposed = false;

  const BEAT_SEC = 0.255; // ~78 dotted-quarter BPM Semachi sway

  function initContext() {
    if (ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    // 1. Procedural Pink-ish Noise Buffer (reused for ocean surf + Janggu brush tap)
    const bufferSize = ctx.sampleRate * 3;
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.153852;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 380;
    surfFilter.Q.value = 0.7;

    const surfGain = ctx.createGain();
    surfGain.gain.value = 0.28;

    lfoOsc = ctx.createOscillator();
    lfoOsc.frequency.value = 0.16;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 210;
    lfoOsc.connect(lfoGain);
    lfoGain.connect(surfFilter.frequency);

    noiseSource.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(masterGain);

    noiseSource.start();
    lfoOsc.start();

    // 2. Jeju Folk BGM Bus with warm coastal delay echo
    bgmGain = ctx.createGain();
    bgmGain.gain.value = isBgmEnabled ? 0.85 : 0;
    bgmGain.connect(masterGain);

    bgmDelayIn = ctx.createGain();
    bgmDelayIn.gain.value = 0.3;
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.28;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1500;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.22;

    bgmDelayIn.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFilter.connect(bgmGain);

    nextNoteTime = ctx.currentTime + 0.08;
    startScheduler();
  }

  // Gayageum-inspired plucked Korean zither note with gentle Nonghyeon vibrato
  function playGayageumNote(freq: number, time: number, durBeats: number) {
    if (!ctx || !bgmGain || !bgmDelayIn) return;
    const durSec = Math.max(0.45, durBeats * BEAT_SEC * 1.45);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 2, time);

    // Traditional Korean Nonghyeon vibrato on sustained notes
    if (durBeats >= 2) {
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vib.frequency.setValueAtTime(5.1, time);
      vibGain.gain.setValueAtTime(0, time);
      vibGain.gain.linearRampToValueAtTime(freq * 0.0045, time + 0.18);
      vib.connect(vibGain);
      vibGain.connect(osc1.frequency);
      vibGain.connect(osc2.frequency);
      vib.start(time);
      vib.stop(time + durSec + 0.05);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5200, freq * 5.2), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.6), time + 0.24);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.16, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.048, time + 0.18);
    env.gain.exponentialRampToValueAtTime(0.0001, time + durSec);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.25;

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(env);
    env.connect(bgmGain);
    env.connect(bgmDelayIn);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + durSec + 0.04);
    osc2.stop(time + durSec + 0.04);
  }

  // Warm bass accompaniment plucked on Geomungo / low string
  function playGeomungoBass(freq: number, time: number) {
    if (!ctx || !bgmGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.5, time);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.11, time + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.68);

    osc.connect(env);
    env.connect(bgmGain);
    osc.start(time);
    osc.stop(time + 0.72);
  }

  // Soft Janggu drum pulse (Kung on downbeat, subtle Chae tap on beat 3)
  function playJangguPulse(kind: 'kung' | 'deok', time: number) {
    if (!ctx || !bgmGain) return;
    if (kind === 'kung') {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(118, time);
      osc.frequency.exponentialRampToValueAtTime(54, time + 0.14);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.095, time + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

      osc.connect(env);
      env.connect(bgmGain);
      osc.start(time);
      osc.stop(time + 0.24);
    } else if (noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1750;
      bp.Q.value = 2.0;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.06, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

      src.connect(bp);
      bp.connect(env);
      env.connect(bgmGain);
      src.start(time);
      src.stop(time + 0.09);
    }
  }

  function startScheduler() {
    if (schedulerTimer !== null) return;
    schedulerTimer = window.setInterval(() => {
      if (disposed || !ctx || ctx.state !== 'running') return;
      if (isMuted || !isBgmEnabled) {
        nextNoteTime = ctx.currentTime + 0.05;
        return;
      }

      while (nextNoteTime < ctx.currentTime + 0.25) {
        const [note, durBeats] = JEJU_FOLK_SCORE[scoreIndex];
        if (note && NOTE_FREQS[note]) {
          const f = NOTE_FREQS[note];
          playGayageumNote(f, nextNoteTime, durBeats);

          // Semachi 3-beat accompaniment
          const beatInBar = Math.round(beatAccumulator) % 3;
          if (beatInBar === 0) {
            playJangguPulse('kung', nextNoteTime);
            // Warm pentatonic bass root (C or G)
            const bassFreq = note === 'G4' || note === 'D5' || note === 'G5' ? NOTE_FREQS.G3 : NOTE_FREQS.C4;
            playGeomungoBass(bassFreq, nextNoteTime);
          } else if (beatInBar === 2) {
            playJangguPulse('deok', nextNoteTime);
          }
        }

        nextNoteTime += durBeats * BEAT_SEC;
        beatAccumulator += durBeats;
        scoreIndex = (scoreIndex + 1) % JEJU_FOLK_SCORE.length;
      }
    }, 60);
  }

  function applyGains() {
    if (!ctx || !masterGain || !bgmGain) return;
    const masterTarget = isMuted ? 0 : 0.72;
    masterGain.gain.setTargetAtTime(masterTarget, ctx.currentTime, 0.22);
    bgmGain.gain.setTargetAtTime(isBgmEnabled ? 0.85 : 0, ctx.currentTime, 0.2);
  }

  function setMuted(muted: boolean) {
    isMuted = muted;
    userExplicitlyMuted = muted;
    if (!muted) {
      initContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
    applyGains();
  }

  function setBgmEnabled(enabled: boolean) {
    isBgmEnabled = enabled;
    if (enabled && isMuted) {
      isMuted = false;
      userExplicitlyMuted = false;
    }
    if (enabled) {
      initContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
    applyGains();
  }

  function unlockFromGesture() {
    if (userExplicitlyMuted) return;
    initContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(applyGains).catch(() => {});
    } else {
      applyGains();
    }
  }

  function triggerBellStrike(delaySec: number) {
    if (!ctx || !masterGain) return;
    const t0 = ctx.currentTime + delaySec;

    const freqs = [1560, 3125, 4680];
    const gains = [0.22, 0.11, 0.05];

    freqs.forEach((f, idx) => {
      if (!ctx || !masterGain) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gains[idx], t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (idx === 0 ? 0.65 : 0.35));

      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.7);
    });
  }

  function ringBell() {
    if (isMuted) {
      setMuted(false);
    }
    initContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(applyGains).catch(() => {});
    } else {
      applyGains();
    }
    triggerBellStrike(0);
    triggerBellStrike(0.16);
  }

  function dispose() {
    disposed = true;
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    try {
      noiseSource?.stop();
      lfoOsc?.stop();
      ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    ctx = null;
  }

  return {
    get isMuted() {
      return isMuted;
    },
    get isBgmEnabled() {
      return isBgmEnabled;
    },
    setMuted,
    setBgmEnabled,
    unlockFromGesture,
    ringBell,
    dispose,
  };
}
