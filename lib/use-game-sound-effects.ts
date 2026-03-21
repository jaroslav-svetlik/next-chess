"use client";

import { useEffect, useEffectEvent, useRef } from "react";

type GameSoundStatus = "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";

type GameSoundState = {
  gameId: string;
  status: GameSoundStatus;
  result: string | null;
  moveCount: number;
};

type ToneConfig = {
  at: number;
  duration: number;
  fromFrequency: number;
  toFrequency?: number;
  type?: OscillatorType;
  volume?: number;
};

type NoiseConfig = {
  at: number;
  duration: number;
  volume?: number;
  highpass?: number;
  lowpass?: number;
};

type BrowserAudioContext = AudioContext;
type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function canUseAudio() {
  if (typeof window === "undefined") {
    return false;
  }

  const audioWindow = window as AudioWindow;
  return !!(audioWindow.AudioContext || audioWindow.webkitAudioContext);
}

function createAudioContext() {
  const audioWindow = window as AudioWindow;
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  return new AudioContextCtor() as BrowserAudioContext;
}

function scheduleTone(context: BrowserAudioContext, config: ToneConfig) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const stopAt = config.at + config.duration + 0.04;

  oscillator.type = config.type ?? "sine";
  oscillator.frequency.setValueAtTime(config.fromFrequency, config.at);

  if (config.toFrequency && config.toFrequency !== config.fromFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      config.toFrequency,
      config.at + config.duration
    );
  }

  gainNode.gain.setValueAtTime(0.0001, config.at);
  gainNode.gain.exponentialRampToValueAtTime(config.volume ?? 0.08, config.at + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, config.at + config.duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(config.at);
  oscillator.stop(stopAt);
}

function scheduleNoise(context: BrowserAudioContext, config: NoiseConfig) {
  const frameCount = Math.ceil(context.sampleRate * (config.duration + 0.06));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * Math.exp((-index / frameCount) * 7);
  }

  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const gainNode = context.createGain();

  source.buffer = buffer;
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(config.highpass ?? 850, config.at);
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(config.lowpass ?? 3200, config.at);

  gainNode.gain.setValueAtTime(0.0001, config.at);
  gainNode.gain.exponentialRampToValueAtTime(config.volume ?? 0.02, config.at + 0.004);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, config.at + config.duration);

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gainNode);
  gainNode.connect(context.destination);

  source.start(config.at);
  source.stop(config.at + config.duration + 0.05);
}

export function useGameSoundEffects({ gameId, moveCount, result, status }: GameSoundState) {
  const audioContextRef = useRef<BrowserAudioContext | null>(null);
  const previousStateRef = useRef<GameSoundState | null>(null);

  const ensureAudioContext = useEffectEvent(async () => {
    if (!canUseAudio()) {
      return null;
    }

    let context = audioContextRef.current;

    if (!context) {
      context = createAudioContext();
      audioContextRef.current = context;
    }

    if (!context) {
      return null;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return null;
      }
    }

    return context;
  });

  const playMoveSound = useEffectEvent(async () => {
    const context = await ensureAudioContext();

    if (!context) {
      return;
    }

    const at = context.currentTime + 0.01;
    scheduleNoise(context, {
      at,
      duration: 0.028,
      volume: 0.012,
      highpass: 920,
      lowpass: 2600
    });
    scheduleTone(context, {
      at,
      duration: 0.032,
      fromFrequency: 220,
      toFrequency: 165,
      type: "triangle",
      volume: 0.03
    });
    scheduleTone(context, {
      at: at + 0.006,
      duration: 0.04,
      fromFrequency: 490,
      toFrequency: 340,
      type: "sine",
      volume: 0.009
    });
  });

  const playStartSound = useEffectEvent(async () => {
    const context = await ensureAudioContext();

    if (!context) {
      return;
    }

    const at = context.currentTime + 0.01;
    scheduleNoise(context, {
      at,
      duration: 0.03,
      volume: 0.009,
      highpass: 1100,
      lowpass: 2800
    });
    scheduleTone(context, {
      at,
      duration: 0.06,
      fromFrequency: 392,
      type: "triangle",
      volume: 0.02
    });
    scheduleTone(context, {
      at: at + 0.065,
      duration: 0.07,
      fromFrequency: 523.25,
      type: "triangle",
      volume: 0.022
    });
    scheduleTone(context, {
      at: at + 0.14,
      duration: 0.085,
      fromFrequency: 659.25,
      type: "triangle",
      volume: 0.024
    });
  });

  const playAbortSound = useEffectEvent(async () => {
    const context = await ensureAudioContext();

    if (!context) {
      return;
    }

    const at = context.currentTime + 0.01;
    scheduleNoise(context, {
      at,
      duration: 0.04,
      volume: 0.01,
      highpass: 700,
      lowpass: 1800
    });
    scheduleTone(context, {
      at,
      duration: 0.09,
      fromFrequency: 280,
      toFrequency: 170,
      type: "triangle",
      volume: 0.02
    });
    scheduleTone(context, {
      at: at + 0.07,
      duration: 0.14,
      fromFrequency: 180,
      toFrequency: 120,
      type: "sine",
      volume: 0.015
    });
  });

  const playCheckmateSound = useEffectEvent(async () => {
    const context = await ensureAudioContext();

    if (!context) {
      return;
    }

    const at = context.currentTime + 0.02;
    scheduleNoise(context, {
      at,
      duration: 0.03,
      volume: 0.008,
      highpass: 1000,
      lowpass: 2500
    });
    scheduleTone(context, {
      at,
      duration: 0.075,
      fromFrequency: 523.25,
      type: "triangle",
      volume: 0.02
    });
    scheduleTone(context, {
      at: at + 0.08,
      duration: 0.085,
      fromFrequency: 659.25,
      type: "triangle",
      volume: 0.024
    });
    scheduleTone(context, {
      at: at + 0.17,
      duration: 0.18,
      fromFrequency: 783.99,
      toFrequency: 698.46,
      type: "triangle",
      volume: 0.028
    });
    scheduleTone(context, {
      at: at + 0.2,
      duration: 0.23,
      fromFrequency: 1046.5,
      toFrequency: 987.77,
      type: "sine",
      volume: 0.015
    });
  });

  useEffect(() => {
    if (!canUseAudio()) {
      return;
    }

    function unlockAudio() {
      void ensureAudioContext();
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [ensureAudioContext]);

  useEffect(() => {
    const previousState = previousStateRef.current;
    const nextState = {
      gameId,
      status,
      result,
      moveCount
    } satisfies GameSoundState;

    if (!previousState || previousState.gameId !== gameId) {
      previousStateRef.current = nextState;
      return;
    }

    if (previousState.status !== "ACTIVE" && status === "ACTIVE") {
      void playStartSound();
    }

    if (moveCount > previousState.moveCount) {
      void playMoveSound();

      if (status === "FINISHED" && result?.endsWith("_checkmate")) {
        window.setTimeout(() => {
          void playCheckmateSound();
        }, 160);
      }
    } else if (previousState.status !== status && status === "CANCELLED") {
      void playAbortSound();
    } else if (
      previousState.status !== status &&
      status === "FINISHED" &&
      result?.endsWith("_checkmate")
    ) {
      void playCheckmateSound();
    }

    previousStateRef.current = nextState;
  }, [gameId, moveCount, playAbortSound, playCheckmateSound, playMoveSound, playStartSound, result, status]);
}
