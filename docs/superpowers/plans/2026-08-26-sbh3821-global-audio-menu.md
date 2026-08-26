# 전역 오디오·퀵 메뉴 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 OFF인 공통 BGM과 UI 효과음, 전역 퀵 메뉴, 캠페인을 보존하는 업적 오버레이를 구현한다.

**Architecture:** 루트 레이아웃에 영속적인 `AppAudioProvider`와 단일 DOM 루트 `AppFrame`을 두고, 오디오 설정 Store·브라우저 재생 adapter·표현 컴포넌트를 분리한다. 업적 기록은 전역 메뉴에서 route 이동 없이 native dialog 오버레이로 열며, 독립 `/achievements` route는 검증된 내부 복귀 경로만 사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand vanilla store, HTMLAudioElement, localStorage, Node.js PCM WAV 생성, Vitest, Playwright Chromium

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-global-audio-menu-design.md`

## Global Constraints

- 기준 캔버스는 1920×1080, 16:9이며 새 `vw`·`vh`와 미디어 쿼리를 추가하지 않는다.
- BGM과 효과음의 최초값은 모두 OFF다. 사용자 입력 전에는 어떤 소리도 내지 않는다.
- BGM은 한 곡이며 route 전환에도 같은 재생 인스턴스와 위치를 유지한다.
- 음량은 BGM `0.25`, UI 효과음 `0.45`로 고정한다.
- 저장 키는 `dungeon-schemer.audio-settings.v1`, payload version은 `1`이다.
- 음원은 로컬 PCM WAV 세 파일이며 외부 CDN·스트리밍·새 런타임 의존성을 사용하지 않는다.
- 전역 메뉴에서 여는 업적 기록은 현재 캠페인 Provider를 unmount하지 않는다.
- 기존 `GameShell`, U2~U6 props와 domain/rules/campaign store를 오디오 때문에 변경하지 않는다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- 구현 시 현재 전용 worktree인지 `git rev-parse --git-dir`과 `git rev-parse --git-common-dir`로 먼저 확인한다. 이미 linked worktree면 새 worktree를 만들지 않는다.

## File Map

### 새 파일

- `lib/audio/audio-settings.ts` — V1 타입과 기본값
- `lib/audio/audio-settings-storage.ts` — localStorage 검증·복구·저장 adapter
- `lib/audio/audio-settings-storage.test.ts` — 저장 경계 테스트
- `lib/audio/audio-playback.ts` — HTMLAudioElement를 감싼 재생 controller
- `lib/audio/audio-playback.test.ts` — play·pause·효과음·실패 테스트
- `lib/audio/audio-assets.test.ts` — WAV header·길이·peak·DC·loop seam 검사
- `lib/store/audio-settings-store.ts` — 설정·재생 상태를 합성하는 Zustand store
- `lib/store/audio-settings-store.test.ts` — hydrate·토글·재생 대기·fallback 테스트
- `components/game/AppAudioProvider.tsx` — store와 브라우저 Audio 수명 연결
- `components/game/AppFrame.tsx` — 화면 slot·공통 click·메뉴·업적 overlay 합성
- `components/game/GlobalQuickMenu.tsx` — 접근 가능한 길드 문장 메뉴
- `components/game/GlobalQuickMenu.test.tsx` — OFF/ON 문구와 switch 마크업 테스트
- `components/game/AchievementOverlay.tsx` — native dialog 업적 오버레이
- `components/game/AchievementOverlay.test.ts` — modal open·cancel·cleanup helper 테스트
- `app/app-frame.css` — 공통 chrome, 메뉴, overlay 스타일
- `scripts/generate-audio-assets.mjs` — 고정 seed PCM WAV 생성기
- `public/assets/audio/dungeon-schemer-guild-loop.wav` — 64초 공통 BGM
- `public/assets/audio/ui-select.wav` — 일반 UI 선택음
- `public/assets/audio/ui-menu.wav` — 메뉴·토글음
- `e2e/audio-menu.spec.ts` — 실제 브라우저 오디오·메뉴·업적 복귀 회귀

### 수정 파일

- `package.json` — `audio:generate` 스크립트
- `app/layout.tsx` — `AppAudioProvider`·`AppFrame`·CSS 연결
- `app/page.test.ts` — 메인 메뉴 업적 returnTo 계약
- `app/achievements/page.tsx` — 안전한 returnTo 해석
- `app/achievements/page.test.ts` — 이전 화면 CTA와 fallback
- `components/game/AchievementScreen.tsx` — link/button 공용 복귀 action
- `components/game/AchievementScreen.test.tsx` — 이전 화면 문구·action 종류
- `components/game/MainMenuScreen.tsx` — `/achievements?returnTo=/` 링크
- `components/game/MainMenuScreen.test.tsx` — query 포함 링크
- `e2e/canvas-layout.spec.ts` — AppFrame 전체 점유와 메뉴 viewport
- `e2e/routes.spec.ts` — 독립 업적 route 포함
- `docs/experience/SCREEN_LAYOUT.md` — 공통 chrome 안전 영역
- `docs/experience/ONBOARDING_AND_INTERFACE.md` — 메뉴·오버레이 흐름
- `docs/technical/SESSION_PERSISTENCE_REVIEW.md` — 오디오 설정 저장 경계
- `docs/technical/DEVELOPMENT_ENVIRONMENT.md` — 음원 생성·검증 명령
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` — 메타 작업 상태
- `docs/diagram/screens.md` — 열린 메뉴 캡처
- `docs/diagram/png/screen-global-menu.png` — 1920×1080 대표 캡처

---

### Task 1: 오디오 설정 V1과 저장 adapter

**Files:**
- Create: `lib/audio/audio-settings.ts`
- Create: `lib/audio/audio-settings-storage.ts`
- Create: `lib/audio/audio-settings-storage.test.ts`

**Interfaces:**
- Consumes: 브라우저와 테스트가 제공하는 `StringStorage`
- Produces: `AudioSettingsV1`, `createDefaultAudioSettings()`, `loadAudioSettings()`, `saveAudioSettings()`, `acquireAudioSettingsStorage()`, `AUDIO_SETTINGS_STORAGE_KEY`

- [ ] **Step 1: 기본값·정상값·손상값·미래 버전·예외를 고정하는 실패 테스트 작성**

`lib/audio/audio-settings-storage.test.ts`에 메모리 저장소를 만들고 다음 계약을 적는다.

```ts
const empty = { version: 1, bgmEnabled: false, sfxEnabled: false } as const;

expect(loadAudioSettings(memoryStorage())).toEqual({ status: "empty", settings: empty });
expect(loadAudioSettings(memoryStorage({
  [AUDIO_SETTINGS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    bgmEnabled: true,
    sfxEnabled: false,
  }),
}))).toEqual({
  status: "ready",
  settings: { version: 1, bgmEnabled: true, sfxEnabled: false },
});

const broken = loadAudioSettings(memoryStorage({
  [AUDIO_SETTINGS_STORAGE_KEY]: "{broken",
}));
expect(broken).toMatchObject({ status: "recovered", settings: empty });

const futureRaw = JSON.stringify({ version: 2, bgmEnabled: true, sfxEnabled: true });
expect(loadAudioSettings(memoryStorage({
  [AUDIO_SETTINGS_STORAGE_KEY]: futureRaw,
}))).toMatchObject({ status: "unavailable", raw: futureRaw });
```

잘못된 extra key, boolean이 아닌 값, localStorage getter 예외, getItem/setItem 예외도 각각 단언한다. 미래 버전 저장소에 `saveAudioSettings`를 호출하지 않는 것은 Task 3 Store 테스트에서 고정한다.

- [ ] **Step 2: 테스트가 정의 누락으로 실패하는지 확인**

Run: `pnpm test -- lib/audio/audio-settings-storage.test.ts`

Expected: FAIL — `audio-settings-storage` 또는 export를 찾을 수 없음.

- [ ] **Step 3: V1 타입·엄격 구조 검증·저장 adapter 구현**

`lib/audio/audio-settings.ts`의 공개 계약은 다음과 같이 둔다.

```ts
export const AUDIO_SETTINGS_VERSION = 1 as const;

export interface AudioSettingsV1 {
  readonly version: 1;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
}

export function createDefaultAudioSettings(): AudioSettingsV1 {
  return { version: AUDIO_SETTINGS_VERSION, bgmEnabled: false, sfxEnabled: false };
}
```

`lib/audio/audio-settings-storage.ts`는 정확히 세 key만 허용한다.

```ts
export const AUDIO_SETTINGS_STORAGE_KEY = "dungeon-schemer.audio-settings.v1";

const SETTINGS_KEYS = ["version", "bgmEnabled", "sfxEnabled"] as const;

export type AudioSettingsLoadResult =
  | { readonly status: "empty" | "ready"; readonly settings: AudioSettingsV1 }
  | { readonly status: "recovered"; readonly settings: AudioSettingsV1; readonly raw: string }
  | { readonly status: "unavailable"; readonly settings: AudioSettingsV1; readonly reason: string; readonly raw?: string };
```

`loadAudioSettings`는 JSON parse와 exact-key·boolean 검증을 수행한다. version이 `1`
보다 크면 `unavailable`, 그 외 손상값은 `recovered`다. `saveAudioSettings`는 예외를
던지지 않고 `{ ok: true } | { ok: false; reason: string }`을 반환한다.

- [ ] **Step 4: 저장 adapter 테스트 통과 확인**

Run: `pnpm test -- lib/audio/audio-settings-storage.test.ts`

Expected: PASS — 빈값·정상 V1·손상 복구·미래 버전·접근 예외 전체 통과.

- [ ] **Step 5: Task 1 커밋**

```bash
git add lib/audio/audio-settings.ts lib/audio/audio-settings-storage.ts lib/audio/audio-settings-storage.test.ts
git commit -m "기능: 오디오 설정 저장 계약을 만든다" -m "BGM과 효과음의 기본 OFF V1을 엄격히 검증하고 저장 실패를 메모리 fallback용 결과로 반환한다."
```

---

### Task 2: 결정적 BGM·UI 효과음 생성

**Files:**
- Create: `scripts/generate-audio-assets.mjs`
- Create: `lib/audio/audio-assets.test.ts`
- Create: `public/assets/audio/dungeon-schemer-guild-loop.wav`
- Create: `public/assets/audio/ui-select.wav`
- Create: `public/assets/audio/ui-menu.wav`
- Modify: `package.json`

**Interfaces:**
- Consumes: Node.js `fs`, 고정 sample rate `22050`, 고정 seed `0x44534348`
- Produces: `pnpm audio:generate`, 브라우저가 직접 읽는 PCM WAV 세 파일

- [ ] **Step 1: 아직 없는 WAV 세 파일의 형식·음량 계약 테스트 작성**

`lib/audio/audio-assets.test.ts`에서 RIFF/WAVE header를 `Buffer.readUInt*LE`로 읽는다.

```ts
const cases = [
  ["dungeon-schemer-guild-loop.wav", 2, 64, 0.02],
  ["ui-select.wav", 1, 0.15, 0.04],
  ["ui-menu.wav", 1, 0.23, 0.04],
] as const;

for (const [name, channels, seconds, tolerance] of cases) {
  const wav = readWav(join(process.cwd(), "public", "assets", "audio", name));
  expect(wav.audioFormat).toBe(1);
  expect(wav.channels).toBe(channels);
  expect(wav.sampleRate).toBe(22_050);
  expect(wav.bitsPerSample).toBe(16);
  expect(Math.abs(wav.duration - seconds)).toBeLessThanOrEqual(tolerance);
  expect(wav.peak).toBeLessThanOrEqual(Math.round(32_767 * 10 ** (-1 / 20)));
  expect(Math.abs(wav.mean)).toBeLessThan(80);
}
```

BGM에는 첫 frame과 마지막 frame의 채널별 차이가 `1200` 미만인지, UI 파일에는
마지막 128 frame의 최대 절댓값이 `240` 미만인지도 검사한다.

- [ ] **Step 2: 자산 부재로 테스트가 실패하는지 확인**

Run: `pnpm test -- lib/audio/audio-assets.test.ts`

Expected: FAIL — `public/assets/audio/*.wav` ENOENT.

- [ ] **Step 3: 표준 Node.js만 쓰는 PCM WAV 생성기 구현**

`scripts/generate-audio-assets.mjs`는 다음 고정 상수와 helper를 사용한다.

```js
const SAMPLE_RATE = 22_050;
const PCM_MAX = 32_767;
const PEAK = 10 ** (-1 / 20);
const BGM_SECONDS = 64;
const SEED = 0x44534348;

function quantizedHz(hz, seconds) {
  return Math.round(hz * seconds) / seconds;
}

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function softClip(sample) {
  return Math.tanh(sample * 1.15) / Math.tanh(1.15);
}
```

BGM raw channel은 각 sample 시각 `t`에서 아래 성분을 합산한다. 비주기 noise인
`air`에는 `sin(πt / 64)²` seam envelope를 곱해 첫·마지막 frame을 0으로 수렴시킨다.

```js
const drone = 0.20 * Math.sin(2 * Math.PI * quantizedHz(73.42, 64) * t)
  + 0.10 * Math.sin(2 * Math.PI * quantizedHz(110, 64) * t + 0.35);
const air = (random() * 2 - 1) * 0.018 * (0.65 + 0.35 * Math.sin(2 * Math.PI * t / 16));
const pulse = 0.025 * Math.sin(2 * Math.PI * quantizedHz(55, 64) * t)
  * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / 4));
```

16개 마디마다 `[146.83, 174.61, 220, 261.63, 220, 174.61, 196, 146.83]`
순서를 반복하고 각 마디 `2.0`초와 `3.5`초에 1.25초 감쇠 pluck을 더한다. 단,
마지막 마디의 `3.5`초 pluck은 생략한다. pluck은 `exp(-4.8 * age) *
(sin(2πf·age) + 0.32sin(4πf·age))`다. 프레임 드럼은 각 마디의 `0.0`초와
`2.75`초에 0.22초 동안 고정 PRNG noise와 58Hz sine을 `exp(-18 * age)`로
감쇠하되, 첫 마디의 `0.0`초와 마지막 마디의 `2.75`초는 생략한다. 이 배치로
첫·마지막 0.75초에는 pluck과 drum이 시작되지 않는다.

raw stereo에 0.19초·0.31초·0.47초 circular delay를 각각 `0.13`, `0.09`,
`0.06` gain으로 더해 loop 가능한 잔향을 만들고, DC mean을 뺀 뒤 두 채널을 함께
`PEAK`까지 정규화한다. `writePcm16Wav(path, channels)`는 44-byte RIFF header와
interleaved signed 16-bit samples를 쓴다.

`ui-select.wav`는 0.15초 동안 고정 noise에 145Hz·230Hz 감쇠 sine을 섞고
`exp(-30t)`로 감쇠한다. `ui-menu.wav`는 0.23초 동안 620Hz와 930Hz 금속 partial을
`exp(-18t)`로 감쇠하고 0.045초 뒤 470Hz partial을 더한다. 두 파일 모두 마지막
128 frame에 linear fade를 적용한다.

`package.json`에 다음 script를 추가한다.

```json
"audio:generate": "node scripts/generate-audio-assets.mjs"
```

- [ ] **Step 4: 음원을 생성하고 자산 테스트 통과 확인**

Run: `pnpm audio:generate && pnpm test -- lib/audio/audio-assets.test.ts`

Expected: 세 WAV 생성, 형식·길이·peak·DC·끝단 검사 PASS.

- [ ] **Step 5: 생성 결정성 확인**

Run:

```bash
node -e "const fs=require('node:fs'),c=require('node:crypto');for(const f of fs.readdirSync('public/assets/audio').filter(x=>x.endsWith('.wav')).sort())console.log(f,c.createHash('sha256').update(fs.readFileSync('public/assets/audio/'+f)).digest('hex'))"
pnpm audio:generate
node -e "const fs=require('node:fs'),c=require('node:crypto');for(const f of fs.readdirSync('public/assets/audio').filter(x=>x.endsWith('.wav')).sort())console.log(f,c.createHash('sha256').update(fs.readFileSync('public/assets/audio/'+f)).digest('hex'))"
```

Expected: 생성 전후 세 SHA-256이 각각 동일.

- [ ] **Step 6: Task 2 커밋**

```bash
git add package.json scripts/generate-audio-assets.mjs lib/audio/audio-assets.test.ts public/assets/audio
git commit -m "에셋: 길드 BGM과 UI 효과음을 만든다" -m "고정 seed Node 생성기로 64초 loop와 두 조작음을 재현 가능하게 만들고 WAV 형식과 음량 경계를 검사한다."
```

---

### Task 3: 브라우저 재생 controller와 전역 오디오 Store

**Files:**
- Create: `lib/audio/audio-playback.ts`
- Create: `lib/audio/audio-playback.test.ts`
- Create: `lib/store/audio-settings-store.ts`
- Create: `lib/store/audio-settings-store.test.ts`
- Create: `components/game/AppAudioProvider.tsx`
- Modify: `docs/superpowers/specs/2026-08-26-sbh3821-global-audio-menu-design.md`

**Interfaces:**
- Consumes: Task 1의 storage adapter, Task 2의 WAV 경로
- Produces: `AudioPlaybackController`, `createBrowserAudioPlayback()`, `createAudioSettingsStore()`, `AppAudioProvider`, `useAppAudioStore()`

- [ ] **Step 1: 재생 controller의 loop·volume·pause·효과음 restart 테스트 작성**

`lib/audio/audio-playback.test.ts`의 fake element는 `playCalls`, `pauseCalls`,
`currentTime`, `loop`, `volume`을 기록한다.

```ts
const controller = createAudioPlaybackController({ bgm, select, menu });

expect(bgm.loop).toBe(true);
expect(bgm.volume).toBe(0.25);
expect(select.volume).toBe(0.45);
expect(menu.volume).toBe(0.45);

await controller.playBgm();
expect(bgm.playCalls).toBe(1);
controller.pauseBgm();
expect(bgm.pauseCalls).toBe(1);

select.currentTime = 0.1;
await controller.playUiSound("select");
expect(select.currentTime).toBe(0);
expect(select.playCalls).toBe(1);
```

`dispose()`가 세 element를 pause하고, rejected play promise가 caller에게 전달되는지도
검사한다.

- [ ] **Step 2: Store의 hydrate·재생 대기·토글·미래 버전 보존 테스트 작성**

`lib/store/audio-settings-store.test.ts`는 fake playback port를 주입한다.

```ts
const store = createAudioSettingsStore();
store.getState().attachPlayback(playback);
store.getState().hydrate(memoryStorage());
expect(store.getState()).toMatchObject({
  settings: { version: 1, bgmEnabled: false, sfxEnabled: false },
  status: "ready",
});

await store.getState().toggleBgm();
expect(playback.calls).toContain("play-bgm");
expect(store.getState().settings.bgmEnabled).toBe(true);

await store.getState().toggleSfx();
expect(playback.calls.at(-1)).toBe("play-menu");
expect(store.getState().settings.sfxEnabled).toBe(true);
```

저장된 `bgmEnabled: true` hydrate 뒤에는 play하지 않고 `BGM 재생 대기` 메시지를
남기며, `resumeBgmFromGesture()`에서 한 번만 play하는지 검사한다. BGM play reject와
효과음 play reject는 해당 설정을 OFF로 되돌리고 실패 문구를 한 번만 남겨야 한다.
미래 V2 raw는 토글 뒤에도 원문이 바뀌지 않아야 한다.

- [ ] **Step 3: 두 테스트가 정의 누락으로 실패하는지 확인**

Run: `pnpm test -- lib/audio/audio-playback.test.ts lib/store/audio-settings-store.test.ts`

Expected: FAIL — controller와 store module을 찾을 수 없음.

- [ ] **Step 4: 주입 가능한 재생 controller 구현**

`lib/audio/audio-playback.ts`에 DOM과 테스트가 공유할 최소 port를 둔다.

```ts
export type UiSoundKind = "select" | "menu";

export interface AudioElementPort {
  currentTime: number;
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

export interface AudioPlaybackController {
  playBgm(): Promise<void>;
  pauseBgm(): void;
  playUiSound(kind: UiSoundKind): Promise<void>;
  dispose(): void;
}
```

`createAudioPlaybackController`는 BGM `loop=true`, volume `0.25`, SFX volume
`0.45`를 한 번 설정한다. `createBrowserAudioPlayback()`는 아래 세 경로로
`new Audio()`를 만들고 controller에 넘긴다.

```ts
const BGM_SRC = "/assets/audio/dungeon-schemer-guild-loop.wav";
const SELECT_SRC = "/assets/audio/ui-select.wav";
const MENU_SRC = "/assets/audio/ui-menu.wav";
```

- [ ] **Step 5: 저장과 재생을 합성하는 Zustand store 구현**

`AudioSettingsStoreState`는 다음 공개 action을 갖는다.

```ts
export interface AudioSettingsStoreState {
  readonly settings: AudioSettingsV1;
  readonly status: "loading" | "ready" | "recovered" | "unavailable";
  readonly message: string | null;
  attachPlayback(playback: AudioPlaybackController): void;
  hydrate(storage: StringStorage): void;
  resumeBgmFromGesture(): Promise<void>;
  toggleBgm(): Promise<void>;
  toggleSfx(): Promise<void>;
  playUiSound(kind: UiSoundKind): Promise<void>;
}
```

Store closure에는 `storage`, `playback`, `futureVersionBlocked`, `bgmPlaying`,
`sfxFailed`를 둔다. 설정 변경 helper는 먼저 메모리 상태를 갱신하고 미래 버전이나
저장소 불가 상태가 아닐 때만 V1을 저장한다. BGM ON은 `playBgm()` 성공 뒤 저장하고,
실패하면 OFF와 `BGM을 재생할 수 없습니다.`를 저장한다. SFX 실패도 OFF로 되돌리고
`효과음을 재생할 수 없습니다.`를 한 번만 표시한다.

이 동작을 spec 6절의 효과음 실패 문장에도 명시해 구현과 문서를 일치시킨다.

- [ ] **Step 6: 루트에서 재사용할 Provider 구현**

`components/game/AppAudioProvider.tsx`는 PlayerProgressProvider 패턴을 따른다.

```tsx
const StoreContext = createContext<AudioSettingsStore | null>(null);

export function AppAudioProvider({ children }: { readonly children: React.ReactNode }) {
  const [store] = useState(() => createAudioSettingsStore());

  useEffect(() => {
    const playback = createBrowserAudioPlayback();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(acquireAudioSettingsStorage(window));
    return () => { playback.dispose(); };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
```

`useAppAudioStore(selector)`는 Provider 밖 호출에 명확한 오류를 던진다. Provider는
추가 DOM wrapper를 렌더하지 않는 static markup 테스트를 Store 테스트에 포함한다.

- [ ] **Step 7: controller·Store·Provider 테스트 통과 확인**

Run: `pnpm test -- lib/audio/audio-playback.test.ts lib/store/audio-settings-store.test.ts`

Expected: PASS — 재생·저장·복구·실패·Provider 경계 전체 통과.

- [ ] **Step 8: Task 3 커밋**

```bash
git add lib/audio components/game/AppAudioProvider.tsx lib/store/audio-settings-store.ts lib/store/audio-settings-store.test.ts docs/superpowers/specs/2026-08-26-sbh3821-global-audio-menu-design.md
git commit -m "기능: 전역 오디오 상태와 재생기를 연결한다" -m "브라우저 Audio 수명을 루트 Provider에 두고 저장 설정과 재생 실패를 독립 Store에서 관리한다."
```

---

### Task 4: 업적 화면의 공용 이전 동작

**Files:**
- Modify: `components/game/AchievementScreen.tsx`
- Modify: `components/game/AchievementScreen.test.tsx`
- Modify: `components/game/MainMenuScreen.tsx`
- Modify: `components/game/MainMenuScreen.test.tsx`
- Modify: `app/achievements/page.tsx`
- Modify: `app/achievements/page.test.ts`
- Modify: `app/page.test.ts`

**Interfaces:**
- Consumes: 기존 `Achievements`와 12개 카드
- Produces: `safeAchievementReturnTo()`, `AchievementBackAction`, route용 link와 overlay용 button 복귀

- [ ] **Step 1: 이전 화면 CTA와 안전한 returnTo 실패 테스트 작성**

`AchievementScreen.test.tsx`의 공용 props에 다음 두 경우를 추가한다.

```tsx
const linkHtml = renderToStaticMarkup(createElement(AchievementScreen, {
  cards: achievementCardViewsFor(createEmptyPlayerProgress()),
  unlockedCount: 0,
  status: "ready",
  message: null,
  backAction: { kind: "link", href: "/" },
  onClear: () => {},
}));
expect(linkHtml).toContain('href="/"');
expect(linkHtml).toContain("이전 화면으로");
expect(linkHtml).not.toContain("메인 메뉴로");

const buttonHtml = renderToStaticMarkup(createElement(AchievementScreen, {
  cards: achievementCardViewsFor(createEmptyPlayerProgress()),
  unlockedCount: 0,
  status: "ready",
  message: null,
  backAction: { kind: "button", onActivate: () => {} },
  onClear: () => {},
}));
expect(buttonHtml).toMatch(/<button[^>]*>이전 화면으로<\/button>/);
```

`app/achievements/page.test.ts`에는 `safeAchievementReturnTo`의 `/`, `/campaign?seed=x`
허용과 `undefined`, `//evil.example`, `https://evil.example`, 역슬래시,
`/achievements` 재귀 경로의 `/` fallback을 표 테스트로 고정한다.

`MainMenuScreen.test.tsx`와 `app/page.test.ts`는 rendered href가
`/achievements?returnTo=%2F`인지 검사한다.

- [ ] **Step 2: 이전 동작 테스트가 현재 문구와 API 때문에 실패하는지 확인**

Run: `pnpm test -- components/game/AchievementScreen.test.tsx components/game/MainMenuScreen.test.tsx app/achievements/page.test.ts app/page.test.ts`

Expected: FAIL — `메인 메뉴로`, backAction 누락, query 누락.

- [ ] **Step 3: AchievementScreen 복귀 action을 link/button 합성으로 변경**

```ts
export type AchievementBackAction =
  | { readonly kind: "link"; readonly href: string }
  | { readonly kind: "button"; readonly onActivate: () => void };
```

`AchievementScreenProps`에 `backAction`을 필수로 추가하고 footer에서 kind를 좁혀
`Link` 또는 `button`을 렌더한다. 둘의 문구와 class는 모두 `이전 화면으로`다.
`Achievements`는 `backAction` prop을 받아 그대로 전달한다.

- [ ] **Step 4: 독립 route와 메인 메뉴 링크에 안전한 복귀 경로 연결**

`app/achievements/page.tsx`의 Server Component page는 Next.js 16의 Promise
`searchParams`를 사용한다.

```ts
type AchievementSearchParams = Promise<{ returnTo?: string | string[] }>;

export function safeAchievementReturnTo(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || value.startsWith("/achievements")) return "/";
  return value;
}

export default async function AchievementPage({ searchParams }: {
  readonly searchParams: AchievementSearchParams;
}) {
  const { returnTo } = await searchParams;
  return <Achievements backAction={{ kind: "link", href: safeAchievementReturnTo(returnTo) }} />;
}
```

메인 메뉴 Link는 object href를 쓴다.

```tsx
<Link
  className="main-menu-screen__achievements"
  href={{ pathname: "/achievements", query: { returnTo: "/" } }}
>
```

- [ ] **Step 5: 업적·메인 메뉴 테스트 통과 확인**

Run: `pnpm test -- components/game/AchievementScreen.test.tsx components/game/MainMenuScreen.test.tsx app/achievements/page.test.ts app/page.test.ts`

Expected: PASS — 12개 카드 회귀 포함, 모든 복귀 문구가 `이전 화면으로`.

- [ ] **Step 6: Task 4 커밋**

```bash
git add components/game/AchievementScreen.tsx components/game/AchievementScreen.test.tsx components/game/MainMenuScreen.tsx components/game/MainMenuScreen.test.tsx app/achievements/page.tsx app/achievements/page.test.ts app/page.test.ts
git commit -m "수정: 업적 기록이 이전 화면으로 돌아간다" -m "독립 route는 검증된 내부 경로로 복귀하고 overlay가 재사용할 버튼 action을 업적 화면에 추가한다."
```

---

### Task 5: 전역 AppFrame·퀵 메뉴·업적 오버레이

**Files:**
- Create: `components/game/GlobalQuickMenu.tsx`
- Create: `components/game/GlobalQuickMenu.test.tsx`
- Create: `components/game/AchievementOverlay.tsx`
- Create: `components/game/AchievementOverlay.test.ts`
- Create: `components/game/AppFrame.tsx`
- Create: `app/app-frame.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 3 `useAppAudioStore`, Task 4 `Achievements` button action
- Produces: 단일 `.app-frame` 캔버스 루트, `GlobalQuickMenu`, route를 바꾸지 않는 `AchievementOverlay`

- [ ] **Step 1: 메뉴의 접근성·문구·메뉴 전용 sound 표식 실패 테스트 작성**

`GlobalQuickMenu.test.tsx`는 presentational props로 OFF와 ON을 각각 렌더한다.

```tsx
const html = renderToStaticMarkup(createElement(GlobalQuickMenu, {
  open: true,
  bgmEnabled: false,
  sfxEnabled: false,
  statusMessage: null,
  onToggleOpen: () => {},
  onToggleBgm: () => {},
  onToggleSfx: () => {},
  onOpenAchievements: () => {},
}));

expect(html).toContain('aria-expanded="true"');
expect(html).toContain('role="switch"');
expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
expect(html).toContain("BGM");
expect(html).toContain("효과음");
expect(html.match(/OFF/g)).toHaveLength(2);
expect(html).toContain("업적 기록");
expect(html.match(/data-ui-sound="none"/g)).toHaveLength(4);
```

ON markup은 `aria-checked="true"` 두 개와 `ON` 두 개를 검사한다. 메뉴가 닫혀도
문장 버튼은 렌더되고 패널은 없어야 한다.

- [ ] **Step 2: overlay native modal helper 실패 테스트 작성**

`AchievementOverlay.test.ts`는 DOM 없이 다음 helper를 검사한다.

```ts
const dialog = fakeDialog();
const cleanup = showAchievementOverlayModal(dialog);
expect(dialog.calls).toEqual(["showModal"]);
cleanup();
expect(dialog.calls).toEqual(["showModal", "close"]);

let prevented = false;
let closed = false;
handleAchievementOverlayCancel(
  { preventDefault: () => { prevented = true; } },
  () => { closed = true; },
);
expect({ prevented, closed }).toEqual({ prevented: true, closed: true });
```

- [ ] **Step 3: 새 컴포넌트 부재로 테스트가 실패하는지 확인**

Run: `pnpm test -- components/game/GlobalQuickMenu.test.tsx components/game/AchievementOverlay.test.ts`

Expected: FAIL — 두 component module을 찾을 수 없음.

- [ ] **Step 4: 길드 문장 버튼과 세 항목 메뉴 구현**

`GlobalQuickMenu`는 menu button ref를 prop으로 받고 `aria-expanded`,
`aria-controls="global-quick-menu-panel"`을 제공한다. 버튼 안의 장식은
`aria-hidden="true"`인 작은 inline SVG 방패·음파 문양이며 접근 가능한 이름은
`빠른 메뉴 열기` 또는 `빠른 메뉴 닫기`다.

패널 안의 두 switch는 다음 문구 구조를 공유한다.

```tsx
<button
  type="button"
  role="switch"
  aria-checked={bgmEnabled}
  data-ui-sound="none"
  onClick={onToggleBgm}
>
  <span>BGM</span>
  <strong>{bgmEnabled ? "ON" : "OFF"}</strong>
</button>
```

효과음 switch는 `sfxEnabled`, 업적 버튼은 `onOpenAchievements`를 사용한다.
모든 메뉴 조작은 `data-ui-sound="none"`으로 generic 선택음을 제외한다.

component effect는 열린 동안 document `pointerdown`과 `keydown`을 듣는다. panel과
button 바깥 pointerdown 또는 Escape에서 `onRequestClose()`를 부르고 button에
focus를 돌린다.

- [ ] **Step 5: native dialog 업적 오버레이 구현**

`AchievementOverlay`는 mount effect에서 `showModal()`, cleanup에서 `close()`를
부른다. `onCancel`은 native 기본 닫기를 막고 `onClose()`를 부른다.

```tsx
<dialog
  ref={dialogRef}
  className="app-frame__achievement-dialog"
  aria-label="길잡이 업적 기록"
  onCancel={(event) => handleAchievementOverlayCancel(event, onClose)}
>
  <Achievements backAction={{ kind: "button", onActivate: onClose }} />
</dialog>
```

오버레이가 닫힌 뒤 AppFrame이 전달한 메뉴 button ref에 focus를 돌린다.

- [ ] **Step 6: AppFrame에서 오디오 제스처·generic UI 선택·overlay 상태 합성**

AppFrame state는 `menuOpen`, `achievementsOpen` 두 boolean이다. root markup은 다음
단일 DOM 구조를 유지한다.

```tsx
<div className="app-frame" onClick={handleAppClick}>
  <div className="app-frame__screen" inert={achievementsOpen ? true : undefined}>
    {children}
  </div>
  <GlobalQuickMenu />
  {achievementsOpen ? <AchievementOverlay onClose={closeAchievements} /> : null}
</div>
```

`handleAppClick`은 먼저 `resumeBgmFromGesture()`를 호출한다. event target의
`closest("button, a, [data-ui-sound]")`를 한 번 구하고 disabled,
`aria-disabled="true"`, `data-ui-sound="none"`이면 끝낸다. 나머지는
`playUiSound("select")`를 한 번 호출한다.

메뉴 열기·닫기와 업적 열기는 `playUiSound("menu")`를 명시적으로 호출한다.
두 switch는 Store의 `toggleBgm`, `toggleSfx`가 직접 소리 순서를 소유하므로 추가로
play하지 않는다.

- [ ] **Step 7: AppFrame 전체 점유·메뉴·dialog 스타일 구현**

`app/app-frame.css`의 핵심 고정 캔버스 계약은 다음과 같다.

```css
.app-frame,
.app-frame__screen {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.app-frame {
  position: relative;
  isolation: isolate;
}

.global-quick-menu {
  position: absolute;
  z-index: 80;
  top: 1.2rem;
  right: 1.35rem;
}

.app-frame:has(.achievement-screen) > .global-quick-menu {
  display: none;
}

.app-frame__achievement-dialog {
  width: 120rem;
  height: 67.5rem;
  max-width: none;
  max-height: none;
  margin: auto;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
}
```

메뉴 버튼은 약 `3.1rem`, panel은 `15rem` 너비로 시작한다. 기존 shell gold·metal
token과 화면 texture를 재사용하고, focus-visible outline과 ON/OFF text·switch
thumb 형태를 함께 제공한다. 실제 상태 바 겹침은 Task 6 viewport에서 수치 조정한다.

- [ ] **Step 8: 루트 layout에 Provider와 단일 AppFrame 연결**

`app/layout.tsx`에서 `PlayerProgressProvider`와 screen 사이에 다음 구조를 둔다.

```tsx
<div className="game-canvas">
  <PlayerProgressProvider>
    <AppAudioProvider>
      <AppFrame>{children}</AppFrame>
    </AppAudioProvider>
  </PlayerProgressProvider>
</div>
```

`./app-frame.css`를 achievements CSS 뒤에 import한다. RootLayout static markup
테스트가 `.game-canvas`의 첫 실제 자식으로 `.app-frame`을 보고 기존 화면 내용도
계속 포함하는지 `app/page.test.ts`에 단언한다.

- [ ] **Step 9: 메뉴·overlay·기존 전체 단위 테스트 통과 확인**

Run: `pnpm test -- components/game/GlobalQuickMenu.test.tsx components/game/AchievementOverlay.test.ts app/page.test.ts app/achievements/page.test.ts`

Expected: PASS — 메뉴 마크업, modal helper, 단일 캔버스 root, 업적 카드 회귀 통과.

- [ ] **Step 10: Task 5 커밋**

```bash
git add components/game/GlobalQuickMenu.tsx components/game/GlobalQuickMenu.test.tsx components/game/AchievementOverlay.tsx components/game/AchievementOverlay.test.ts components/game/AppFrame.tsx app/app-frame.css app/layout.tsx app/page.test.ts
git commit -m "기능: 전역 퀵 메뉴에서 업적 기록을 연다" -m "고정 캔버스 공통 chrome에 오디오 스위치와 캠페인을 보존하는 native dialog 업적 오버레이를 연결한다."
```

---

### Task 6: Chromium 상호작용·라우트 지속·viewport 회귀

**Files:**
- Create: `e2e/audio-menu.spec.ts`
- Modify: `e2e/canvas-layout.spec.ts`
- Modify: `e2e/routes.spec.ts`

**Interfaces:**
- Consumes: Task 5의 실제 메뉴·Provider·overlay
- Produces: 브라우저 자동재생 mock 아래의 결정적 상호작용 회귀와 실제 레이아웃 증거

- [ ] **Step 1: HTMLMediaElement 기록 helper와 기본 OFF E2E 작성**

`e2e/audio-menu.spec.ts`의 각 테스트는 navigation 전에 다음 init script를 둔다.

```ts
await page.addInitScript(() => {
  const calls: string[] = [];
  Object.defineProperty(window, "__dungeonAudioCalls", { value: calls });
  HTMLMediaElement.prototype.play = function play() {
    calls.push(`play:${this.src}`);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause() {
    calls.push(`pause:${this.src}`);
  };
});
```

`/`에서 `빠른 메뉴 열기`를 누르고 두 switch가 OFF인지, localStorage가 비어 있거나
OFF V1인지, 첫 메뉴 클릭 전에 play call이 0개인지 검사한다. 메뉴 클릭도 SFX가
OFF이므로 play call을 만들면 안 된다.

- [ ] **Step 2: 토글·저장·reload·route 지속 E2E 작성**

BGM switch를 눌러 BGM WAV play call이 1개인지, 효과음 switch를 눌러 menu WAV
미리듣기가 1개인지 검사한다. localStorage payload의 두 boolean이 true인지 확인한
뒤 reload하고 메뉴를 열어 ON 문구가 복원됐는지 검사한다.

reload 뒤 첫 menu click이 BGM 재생 대기를 해제해 BGM play를 한 번 부르는지,
그 뒤 `캠페인 시작` Link로 이동해도 BGM play call이 추가되지 않는지 검사한다.

- [ ] **Step 3: 캠페인 상태를 보존하는 업적 overlay E2E 작성**

```ts
await page.goto("/campaign?seed=dungeon-schemer");
await page.getByRole("button", { name: "길드 게시판으로" }).click();
await expect(page.getByRole("region", { name: "길드 게시판" })).toBeVisible();

await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
await page.getByRole("button", { name: "업적 기록" }).click();
await expect(page.getByRole("dialog", { name: "길잡이 업적 기록" })).toBeVisible();
expect(new URL(page.url()).pathname).toBe("/campaign");

await page.getByRole("button", { name: "이전 화면으로" }).click();
await expect(page.getByRole("region", { name: "길드 게시판" })).toBeVisible();
expect(new URL(page.url()).pathname).toBe("/campaign");
```

Escape로 overlay를 닫는 경우와 닫힌 뒤 메뉴 button focus도 별도 단언한다.
오버레이 안에서 기존 `업적 기록 초기화`를 눌러 확인 dialog가 위에 열리고,
`취소` 뒤 업적 dialog로 돌아오는 중첩 modal 회귀도 검사한다.

- [ ] **Step 4: 독립 업적 route fallback E2E 작성**

`/achievements`, `/achievements?returnTo=//evil.example`,
`/achievements?returnTo=/campaign?seed=return-test`를 각각 열어 `이전 화면으로`의
href가 앞의 두 경우 `/`, 마지막은 내부 campaign인지 검사한다. 독립 route에서는
`빠른 메뉴 열기`가 visible하지 않아야 한다.

- [ ] **Step 5: canvas viewport에 `/`와 메뉴 열린 상태 추가**

`canvas-layout.spec.ts`의 route 목록에 `/`와 `/achievements`를 추가한다. `/`에서는
메뉴를 연 뒤 menu panel bounding box가 canvas 안에 있고 heading·주요 CTA·상태 bar
bounding box와 겹치지 않는지 검사한다. 네 viewport 모두 `.app-frame`이 canvas와
같은 폭·높이여야 한다.

`routes.spec.ts`에는 `/achievements` marker를 추가하고 모든 공개 route에서 전역
menu button이 achievements를 제외하고 한 개씩 존재하는지 검사한다.

- [ ] **Step 6: E2E를 실행해 실패 원인을 실제 코드로 수정**

Run: `pnpm test:e2e -- e2e/audio-menu.spec.ts e2e/canvas-layout.spec.ts e2e/routes.spec.ts`

Expected: PASS. 자동재생 mock이 있어도 asset request 404, hydration 오류, dialog focus,
canvas overflow는 실제 브라우저에서 검출된다.

- [ ] **Step 7: 실제 음원 재생 smoke 확인**

Playwright mock 없이 로컬 프로덕션 빌드에서 `/`를 열고 BGM·효과음 ON/OFF를 각각
한 번 조작한다. DevTools console·network에 decode 오류와 404가 없고, OFF 직후
BGM이 멈추며 다시 ON했을 때 이전 위치에서 이어지는지 확인한다.

- [ ] **Step 8: Task 6 커밋**

```bash
git add e2e/audio-menu.spec.ts e2e/canvas-layout.spec.ts e2e/routes.spec.ts app/app-frame.css components/game/AppFrame.tsx components/game/GlobalQuickMenu.tsx components/game/AchievementOverlay.tsx
git commit -m "테스트: 전역 오디오 메뉴의 브라우저 흐름을 고정한다" -m "설정 복원과 BGM 지속, 캠페인 보존 업적 overlay, 네 viewport의 메뉴 안전 영역을 Chromium으로 검증한다."
```

---

### Task 7: 공식 문서·대표 캡처·최종 검증

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md`
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/diagram/screens.md`
- Create: `docs/diagram/png/screen-global-menu.png`

**Interfaces:**
- Consumes: 완성된 UI와 음원 생성 명령
- Produces: 현재 구현과 일치하는 공식 문서, 사용자 검토용 1920×1080 캡처, 병합 전 검증 결과

- [ ] **Step 1: 공식 문서에 최종 계약 반영**

다음 내용을 문서별 한 곳에 기록하고 서로 복사하지 않는다.

- `SCREEN_LAYOUT.md`: AppFrame이 새 단일 캔버스 root이며 퀵 메뉴가 우측 상단
  `3.1rem` 문장 버튼과 `15rem` panel 안전 영역을 사용한다.
- `ONBOARDING_AND_INTERFACE.md`: 메인·캠페인에서 메뉴를 열고 업적 overlay를 닫으면
  원래 phase로 돌아오는 흐름, 독립 업적 route의 이전 CTA.
- `SESSION_PERSISTENCE_REVIEW.md`: localStorage 세 번째 허용 키인
  `dungeon-schemer.audio-settings.v1`, 캠페인은 여전히 비영속이라는 경계.
- `DEVELOPMENT_ENVIRONMENT.md`: `pnpm audio:generate`와 WAV 계약 테스트.
- `CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: 메타 작업 행에 전역 오디오·메뉴 완료 범위.
- `screens.md`: 열린 메뉴 대표 화면 링크.

- [ ] **Step 2: 프로덕션 빌드를 실행하고 1920×1080 열린 메뉴 캡처 생성**

Run:

```bash
pnpm build --webpack
pnpm start --hostname 127.0.0.1 --port 3110
```

Chrome을 1920×1080으로 열어 `/`에서 퀵 메뉴를 연 뒤
`docs/diagram/png/screen-global-menu.png`에 캡처한다. BGM·효과음은 OFF로 보여
기본값을 문서화한다. `view_image`로 메뉴가 제목·CTA를 가리지 않고 다크 판타지
금속·금색 언어를 계승하는지 확인한다.

- [ ] **Step 3: 전체 정적·단위·브라우저 검증**

Run:

```bash
git diff --check
pnpm audio:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build --webpack
```

Expected:

- `git diff --check`: 출력 없음
- `audio:generate`: 세 파일 재생성 성공, 이후 worktree diff 없음
- `lint`: 오류 0개
- `typecheck`: 오류 0개
- `test`: 전체 test file과 test 0 failures
- `test:e2e`: Chromium 0 failures
- `build`: `/`, `/achievements`, `/campaign`, 모든 `/uN-test` route 생성 성공

- [ ] **Step 4: 요구사항 대조와 worktree 확인**

```bash
git status --short
git diff --stat HEAD
```

spec 2절 포함 범위와 14절 완료 조건을 한 줄씩 대조한다. 사용자 변경과 무관한 파일,
임시 Chrome profile, `.DS_Store`, 생성 중간 WAV가 staged 대상에 없어야 한다.

- [ ] **Step 5: Task 7 커밋**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SESSION_PERSISTENCE_REVIEW.md docs/technical/DEVELOPMENT_ENVIRONMENT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/diagram/screens.md docs/diagram/png/screen-global-menu.png
git commit -m "문서: 전역 오디오 메뉴의 사용 흐름을 기록한다" -m "공통 chrome과 오디오 설정 저장 경계, 생성 명령, 업적 overlay 복귀 흐름을 공식 문서와 대표 캡처에 반영한다."
```

- [ ] **Step 6: 사용자 확인용 로컬 서버 제공**

최종 `pnpm build --webpack` 산출물을 `http://127.0.0.1:3110/`에서 실행한 채로
유지한다. 사용자에게 메인 메뉴 링크, 업적 직접 링크, 생성 음원 경로, 검증 수치와
최종 commit들을 전달한다.
