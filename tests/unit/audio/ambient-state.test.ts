import { describe, expect, it } from "vitest";

import {
  ambientSoundReducer,
  initialAmbientSoundState,
  shouldMuteAmbientSound,
} from "@/lib/audio/ambient-soundscape";

describe("ambient soundscape state", () => {
  it("starts muted and only becomes audible after an explicit player action", () => {
    expect(initialAmbientSoundState).toEqual({ initialized: false, muted: true });

    const enabled = ambientSoundReducer(initialAmbientSoundState, {
      type: "mute_changed",
      muted: false,
    });
    expect(enabled).toEqual({ initialized: true, muted: false });

    const muted = ambientSoundReducer(enabled, {
      type: "mute_changed",
      muted: true,
    });
    expect(muted).toEqual({ initialized: true, muted: true });
  });

  it("restores the visible preference without claiming that audio initialized", () => {
    expect(
      ambientSoundReducer(initialAmbientSoundState, {
        type: "preference_restored",
        muted: false,
      }),
    ).toEqual({ initialized: false, muted: false });
  });

  it("mutes an enabled soundscape while the document is hidden", () => {
    expect(shouldMuteAmbientSound({ documentHidden: false, userMuted: false })).toBe(
      false,
    );
    expect(shouldMuteAmbientSound({ documentHidden: true, userMuted: false })).toBe(
      true,
    );
    expect(shouldMuteAmbientSound({ documentHidden: false, userMuted: true })).toBe(
      true,
    );
  });
});
