export type AmbientSoundState = Readonly<{
  initialized: boolean;
  muted: boolean;
}>;

export type AmbientSoundAction =
  | Readonly<{ type: "mute_changed"; muted: boolean }>
  | Readonly<{ type: "preference_restored"; muted: boolean }>;

export const initialAmbientSoundState: AmbientSoundState = {
  initialized: false,
  muted: true,
};

export function shouldMuteAmbientSound({
  documentHidden,
  userMuted,
}: {
  documentHidden: boolean;
  userMuted: boolean;
}): boolean {
  return documentHidden || userMuted;
}

export function ambientSoundReducer(
  state: AmbientSoundState,
  action: AmbientSoundAction,
): AmbientSoundState {
  if (action.type === "preference_restored") {
    return { ...state, muted: action.muted };
  }
  return { initialized: true, muted: action.muted };
}

export type AmbientSoundscape = Readonly<{
  destroy: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
}>;

export function createAmbientSoundscape(context: AudioContext): AmbientSoundscape {
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const windFilter = context.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.35;
  windFilter.connect(master);

  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const windData = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < windData.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.985 + white * 0.015;
    windData[index] = previous * 1.8;
  }
  const wind = context.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  wind.connect(windFilter);

  const distantTone = context.createOscillator();
  distantTone.type = "sine";
  distantTone.frequency.value = 92;
  const toneGain = context.createGain();
  toneGain.gain.value = 0.012;
  distantTone.connect(toneGain);
  toneGain.connect(master);

  wind.start();
  distantTone.start();

  return {
    async setMuted(muted) {
      if (!muted && context.state === "suspended") await context.resume();
      const target = muted ? 0 : 0.035;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(target, context.currentTime, 0.08);
    },
    async destroy() {
      try {
        wind.stop();
        distantTone.stop();
      } catch {
        // Nodes may already be stopped during fast route transitions.
      }
      wind.disconnect();
      windFilter.disconnect();
      distantTone.disconnect();
      toneGain.disconnect();
      master.disconnect();
      await context.close();
    },
  };
}
