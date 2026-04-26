let soundReady = false;
let vowelOsc;
let consonantOsc;
let lowOsc;
let finishOscA;
let finishOscB;
let noiseSource;
let noiseFilter;
let toneEnv;
let shortEnv;
let noiseEnv;
let finishEnv;

function setupSoundSystem() {
  if (soundReady) {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== "running") {
      ctx.resume();
    }
    return;
  }

  userStartAudio();

  const ctx = getAudioContext();
  if (ctx && ctx.state !== "running") {
    ctx.resume();
  }

  vowelOsc = new p5.Oscillator("sine");
  vowelOsc.start();
  vowelOsc.amp(0);

  consonantOsc = new p5.Oscillator("triangle");
  consonantOsc.start();
  consonantOsc.amp(0);

  lowOsc = new p5.Oscillator("sawtooth");
  lowOsc.start();
  lowOsc.amp(0);

  finishOscA = new p5.Oscillator("sine");
  finishOscA.start();
  finishOscA.amp(0);

  finishOscB = new p5.Oscillator("triangle");
  finishOscB.start();
  finishOscB.amp(0);

  noiseSource = new p5.Noise("white");
  noiseFilter = new p5.BandPass();
  noiseSource.disconnect();
  noiseSource.connect(noiseFilter);
  noiseFilter.freq(1400);
  noiseFilter.res(12);
  noiseSource.start();
  noiseSource.amp(0);

  toneEnv = new p5.Envelope();
  toneEnv.setADSR(0.006, 0.08, 0.08, 0.18);
  toneEnv.setRange(0.22, 0);

  shortEnv = new p5.Envelope();
  shortEnv.setADSR(0.001, 0.025, 0.01, 0.045);
  shortEnv.setRange(0.18, 0);

  noiseEnv = new p5.Envelope();
  noiseEnv.setADSR(0.001, 0.025, 0.01, 0.06);
  noiseEnv.setRange(0.15, 0);

  finishEnv = new p5.Envelope();
  finishEnv.setADSR(0.01, 0.18, 0.12, 0.42);
  finishEnv.setRange(0.26, 0);

  soundReady = true;

  vowelOsc.freq(880);
  toneEnv.setRange(0.16, 0);
  toneEnv.play(vowelOsc);
}

function playLetterSound(char, profile, uppercase) {
  setupSoundSystem();

  if (!soundReady || !profile) return;

  const base = char.toUpperCase();
  const index = base.charCodeAt(0) - 65;
  const volumeScale = uppercase ? 1.18 : 0.78;

  if (profile.group === "vowel") {
    const freq = 420 + index * 18;
    vowelOsc.freq(freq);
    toneEnv.setADSR(0.006, 0.12, 0.08, uppercase ? 0.28 : 0.18);
    toneEnv.setRange(0.2 * volumeScale, 0);
    toneEnv.play(vowelOsc);

    finishOscB.freq(freq * 1.5);
    shortEnv.setADSR(0.004, 0.05, 0.02, 0.08);
    shortEnv.setRange(0.08 * volumeScale, 0);
    shortEnv.play(finishOscB);
    return;
  }

  if (profile.phonetic === "voiceless") {
    noiseFilter.freq(1400 + index * 55);
    noiseFilter.res(18);
    noiseEnv.setADSR(0.001, 0.025, 0.01, 0.04);
    noiseEnv.setRange(0.24 * volumeScale, 0);
    noiseEnv.play(noiseSource);

    consonantOsc.freq(520 + index * 10);
    shortEnv.setADSR(0.001, 0.02, 0.01, 0.035);
    shortEnv.setRange(0.1 * volumeScale, 0);
    shortEnv.play(consonantOsc);
    return;
  }

  if (profile.phonetic === "voiced") {
    lowOsc.freq(90 + index * 8);
    toneEnv.setADSR(0.008, 0.12, 0.08, 0.22);
    toneEnv.setRange(0.16 * volumeScale, 0);
    toneEnv.play(lowOsc);

    consonantOsc.freq(220 + index * 9);
    shortEnv.setADSR(0.006, 0.06, 0.02, 0.09);
    shortEnv.setRange(0.08 * volumeScale, 0);
    shortEnv.play(consonantOsc);
    return;
  }

  if (profile.phonetic === "nasal") {
    lowOsc.freq(120 + index * 7);
    toneEnv.setADSR(0.02, 0.16, 0.14, 0.34);
    toneEnv.setRange(0.17 * volumeScale, 0);
    toneEnv.play(lowOsc);
    return;
  }

  if (profile.phonetic === "semivowel" || profile.phonetic === "liquid") {
    const freq = 260 + index * 14;
    vowelOsc.freq(freq);
    toneEnv.setADSR(0.012, 0.12, 0.08, 0.2);
    toneEnv.setRange(0.15 * volumeScale, 0);
    toneEnv.play(vowelOsc);

    setTimeout(() => {
      if (!soundReady) return;
      vowelOsc.freq(freq * 1.28);
    }, 55);
    return;
  }

  consonantOsc.freq(260 + index * 12);
  shortEnv.setADSR(0.002, 0.04, 0.02, 0.08);
  shortEnv.setRange(0.12 * volumeScale, 0);
  shortEnv.play(consonantOsc);
}

function playArchiveSound(word, stats) {
  setupSoundSystem();

  if (!soundReady || !word) return;

  const length = max(1, word.length);
  const vowelRatio = stats.vowelCount / length;
  const consonantRatio = stats.consonantCount / length;
  const low = 90 + consonantRatio * 120 + length * 4;
  const high = 460 + vowelRatio * 460 + length * 8;

  finishOscA.freq(low);
  finishEnv.setADSR(0.01, 0.2, 0.12, 0.42);
  finishEnv.setRange(0.26, 0);
  finishEnv.play(finishOscA);

  setTimeout(() => {
    if (!soundReady) return;
    finishOscB.freq(high);
    finishEnv.setRange(0.14, 0);
    finishEnv.play(finishOscB);
  }, 85);

  noiseFilter.freq(1100 + length * 90);
  noiseFilter.res(10);
  noiseEnv.setADSR(0.003, 0.08, 0.03, 0.12);
  noiseEnv.setRange(0.08 + consonantRatio * 0.1, 0);
  noiseEnv.play(noiseSource);
}