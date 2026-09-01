import { useCallback, useEffect, useRef } from 'react';

const TEMPO = 112;
const STEP_DURATION = 60 / TEMPO / 2;
const MASTER_VOLUME = 0.032;

// A light, original pentatonic loop. Keeping it synthesized avoids another
// download and lets the soundtrack pause instantly with the simulation.
const MELODY: Array<number | null> = [
  659.25, 783.99, 880, 783.99,
  659.25, 587.33, 523.25, null,
  587.33, 659.25, 783.99, 659.25,
  587.33, 523.25, 493.88, null,
];

const CHORD_ROOTS = [261.63, 220, 174.61, 196];

interface MusicEngine {
  context: AudioContext;
  master: GainNode;
  toneFilter: BiquadFilterNode;
  timer: number | null;
  nextStepAt: number;
  step: number;
  playing: boolean;
}

const scheduleTone = (
  engine: MusicEngine,
  frequency: number,
  startsAt: number,
  duration: number,
  level: number,
  type: OscillatorType,
) => {
  const oscillator = engine.context.createOscillator();
  const envelope = engine.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  oscillator.detune.setValueAtTime(type === 'triangle' ? 2.5 : -2, startsAt);

  envelope.gain.setValueAtTime(0.0001, startsAt);
  envelope.gain.exponentialRampToValueAtTime(level, startsAt + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);

  oscillator.connect(envelope);
  envelope.connect(engine.toneFilter);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.04);
};

const scheduleStep = (engine: MusicEngine) => {
  const melodyNote = MELODY[engine.step % MELODY.length];
  if (melodyNote) {
    scheduleTone(engine, melodyNote, engine.nextStepAt, STEP_DURATION * 0.72, 0.115, 'triangle');
  }

  if (engine.step % 4 === 0) {
    const chordIndex = Math.floor(engine.step / 4) % CHORD_ROOTS.length;
    const root = CHORD_ROOTS[chordIndex];
    scheduleTone(engine, root, engine.nextStepAt, STEP_DURATION * 2.8, 0.07, 'sine');
    scheduleTone(engine, root * 1.5, engine.nextStepAt + 0.018, STEP_DURATION * 2.6, 0.035, 'sine');
  }

  engine.step += 1;
  engine.nextStepAt += STEP_DURATION;
};

const pumpSequencer = (engine: MusicEngine) => {
  if (!engine.playing || engine.context.state === 'closed') return;

  while (engine.nextStepAt < engine.context.currentTime + 0.22) {
    scheduleStep(engine);
  }

  engine.timer = window.setTimeout(() => pumpSequencer(engine), 80);
};

export const useTownMusic = () => {
  const engineRef = useRef<MusicEngine | null>(null);

  const stopTimer = useCallback((engine: MusicEngine) => {
    if (engine.timer !== null) {
      window.clearTimeout(engine.timer);
      engine.timer = null;
    }
  }, []);

  const play = useCallback(() => {
    let engine = engineRef.current;

    if (!engine || engine.context.state === 'closed') {
      const context = new AudioContext();
      const master = context.createGain();
      const toneFilter = context.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = 2400;
      toneFilter.Q.value = 0.55;
      master.gain.value = 0.0001;
      toneFilter.connect(master);
      master.connect(context.destination);

      engine = {
        context,
        master,
        toneFilter,
        timer: null,
        nextStepAt: context.currentTime + 0.06,
        step: 0,
        playing: false,
      };
      engineRef.current = engine;
    }

    if (engine.playing) return;
    engine.playing = true;
    engine.nextStepAt = engine.context.currentTime + 0.06;
    engine.master.gain.cancelScheduledValues(engine.context.currentTime);
    engine.master.gain.setValueAtTime(Math.max(0.0001, engine.master.gain.value), engine.context.currentTime);
    engine.master.gain.exponentialRampToValueAtTime(MASTER_VOLUME, engine.context.currentTime + 0.32);

    void engine.context.resume().then(() => {
      if (engine?.playing) pumpSequencer(engine);
    });
  }, []);

  const pause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.context.state === 'closed') return;
    engine.playing = false;
    stopTimer(engine);
    engine.master.gain.cancelScheduledValues(engine.context.currentTime);
    engine.master.gain.setValueAtTime(Math.max(0.0001, engine.master.gain.value), engine.context.currentTime);
    engine.master.gain.exponentialRampToValueAtTime(0.0001, engine.context.currentTime + 0.2);
  }, [stopTimer]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.playing = false;
    stopTimer(engine);
    engineRef.current = null;
    void engine.context.close();
  }, [stopTimer]);

  useEffect(() => () => stop(), [stop]);

  return { play, pause, stop };
};
