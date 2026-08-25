export const AUDIO_SETTINGS_VERSION = 1 as const;

export interface AudioSettingsV1 {
  readonly version: 1;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
}

export function createDefaultAudioSettings(): AudioSettingsV1 {
  return {
    version: AUDIO_SETTINGS_VERSION,
    bgmEnabled: false,
    sfxEnabled: false,
  };
}
