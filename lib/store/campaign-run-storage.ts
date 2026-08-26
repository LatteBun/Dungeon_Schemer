import type { CampaignTransition } from "@/lib/domain";

/**
 * 진행 중인 캠페인을 브라우저에 남긴다.
 *
 * 새로고침이나 뒤로가기로 캠페인이 처음으로 돌아가는 것을 막는다. 캐시로는 할
 * 수 없는 일이다 — 새로고침은 JS 힙을 통째로 버리고, bfcache 가 되살리는 것은
 * 규칙 상태가 아니라 화면 상태다. `SESSION_PERSISTENCE_REVIEW.md` 가 적어 둔
 * 대로 그 화면 상태는 오히려 버려야 하는 쪽이므로, 저장은 규칙 상태만 다룬다.
 *
 * 상태를 통째로 적지 않고 **시드와 성공한 액션만** 적는다. `C7` 이 순수
 * 리듀서이고 열한 개 난수 스트림이 전부 시드에서 나오므로, 같은 시드에 같은
 * 액션을 같은 순서로 넣으면 같은 캠페인이 선다. 백테스트가 이미 그 성질 위에
 * 서 있다.
 *
 * 이 방식을 고른 진짜 이유는 크기가 아니라 안전이다. 복원이 규칙 함수를 다시
 * 지나가므로 **규칙이 허락하지 않는 상태로는 복원될 수 없다.** 상태를 통째로
 * 적어 두면 손상되거나 손댄 저장이 도달 불가능한 캠페인을 만들어 낼 수 있고,
 * 그것을 막으려면 `CampaignState` 전체를 검사하는 코드를 따로 들고 가야 한다.
 *
 * 되살리는 일 자체는 `campaign-run.ts` 가 한다. 여기는 읽고 쓰는 일만 맡는다.
 */

export const CAMPAIGN_RUN_STORAGE_KEY = "dungeon-schemer.campaign-run.v1";

export const CAMPAIGN_RUN_CORRUPT_BACKUP_KEY = "dungeon-schemer.campaign-run.corrupt-backup";

export const CAMPAIGN_RUN_VERSION = 1;

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SavedCampaignRun {
  readonly version: number;
  readonly seed: string;
  readonly actions: readonly CampaignTransition[];
}

export type SaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type LoadResult =
  /** 저장이 없다. 새 캠페인으로 시작한다. */
  | { readonly status: "empty" }
  /** 되살릴 수 있다. */
  | { readonly status: "ready"; readonly run: SavedCampaignRun; readonly raw: string }
  /** 더 새 코드가 쓴 저장이다. 옛 코드가 손상 저장으로 오인해 바꾸면 안 된다. */
  | { readonly status: "unsupported"; readonly version: number; readonly raw: string }
  /** 읽었지만 쓸 수 없다. 원문을 남겨 무엇이 문제였는지 말할 수 있게 한다. */
  | { readonly status: "unusable"; readonly reason: string; readonly raw?: string };

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 액션 하나가 저장해도 되는 모양인가.
 *
 * `type` 만 본다. 안쪽 값까지 검사하지 않는 이유는, 검사를 통과시켜 봐야 결국
 * 규칙이 다시 판단하기 때문이다. 모양이 틀리면 재생이 거부하고 그때 버린다.
 */
function looksLikeAction(value: unknown): value is CampaignTransition {
  return typeof value === "object"
    && value !== null
    && typeof (value as { type?: unknown }).type === "string";
}

function parseRun(raw: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "unusable", reason: reasonFor(error), raw };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { status: "unusable", reason: "저장이 객체가 아니다", raw };
  }
  const run = parsed as Partial<SavedCampaignRun>;

  /*
   * 미래 버전은 덮어쓰지 않는다.
   *
   * 오디오 설정이 이미 이 규칙을 쓴다. 새 코드가 쓴 저장을 옛 코드가 열었을 때
   * 지워 버리면, 브라우저를 되돌린 사람이 진행을 잃는다. 쓸 수 없다고만 한다.
   */
  if (typeof run.version === "number" && run.version > CAMPAIGN_RUN_VERSION) {
    return { status: "unsupported", version: run.version, raw };
  }
  if (run.version !== CAMPAIGN_RUN_VERSION) {
    return { status: "unusable", reason: `모르는 저장 버전: ${String(run.version)}`, raw };
  }
  if (typeof run.seed !== "string" || run.seed.length === 0) {
    return { status: "unusable", reason: "시드가 없다", raw };
  }
  if (!Array.isArray(run.actions) || !run.actions.every(looksLikeAction)) {
    return { status: "unusable", reason: "액션 기록이 온전하지 않다", raw };
  }

  return {
    status: "ready",
    run: { version: CAMPAIGN_RUN_VERSION, seed: run.seed, actions: run.actions },
    raw,
  };
}

export function loadCampaignRun(storage: StringStorage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(CAMPAIGN_RUN_STORAGE_KEY);
  } catch (error) {
    return { status: "unusable", reason: reasonFor(error) };
  }
  if (raw === null || raw === "") return { status: "empty" };
  return parseRun(raw);
}

export function saveCampaignRun(storage: StringStorage, run: SavedCampaignRun): SaveResult {
  try {
    storage.setItem(CAMPAIGN_RUN_STORAGE_KEY, JSON.stringify(run));
    return { ok: true };
  } catch (error) {
    /*
     * 저장에 실패해도 게임은 계속된다.
     *
     * 사생활 보호 모드나 용량 초과에서 `setItem` 이 던진다. 그때 캠페인을
     * 멈추는 것은 과한 대가다. 이번 판을 이어할 수 없을 뿐이다.
     */
    return { ok: false, reason: reasonFor(error) };
  }
}

/** 복원 실패 원문을 보존하고 다음 진입이 새 캠페인으로 시작하도록 진행 키를 지운다. */
export function quarantineCampaignRun(storage: StringStorage, input: {
  readonly raw: string;
  readonly reason: string;
  readonly failedAt: number | null;
  readonly capturedAt?: string;
}): { readonly backup: SaveResult; readonly clear: SaveResult } {
  let backup: SaveResult;
  try {
    storage.setItem(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY, JSON.stringify({
      version: 1,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      reason: input.reason,
      failedAt: input.failedAt,
      raw: input.raw,
    }));
    backup = { ok: true };
  } catch (error) {
    backup = { ok: false, reason: reasonFor(error) };
  }
  return { backup, clear: clearSavedCampaignRun(storage) };
}

export function clearCampaignRun(storage: StringStorage): void {
  clearSavedCampaignRun(storage);
}

/** 버그 진단 화면처럼 삭제 성공 여부를 알아야 하는 호출부가 사용한다. */
export function clearSavedCampaignRun(storage: StringStorage): SaveResult {
  try {
    storage.removeItem(CAMPAIGN_RUN_STORAGE_KEY);
    if (storage.getItem(CAMPAIGN_RUN_STORAGE_KEY) !== null) {
      return { ok: false, reason: "캠페인 저장이 남아 있다" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

/**
 * 이 브라우저의 저장소. 없으면 `null` 이다.
 *
 * 서버에는 `localStorage` 가 없고, 사생활 보호 모드에서는 접근 자체가 던진다.
 * 둘 다 저장 없이 노는 것으로 물러선다 — 이어할 수 없을 뿐 게임은 시작된다.
 */
export function browserCampaignStorage(): StringStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 이어할 판이 있는가. 메인 메뉴의 「이어하기」가 이것으로 갈린다. */
export function hasSavedCampaignRun(): boolean {
  const storage = browserCampaignStorage();
  if (storage === null) return false;
  return loadCampaignRun(storage).status === "ready";
}

/** 이어하기를 버린다. 「새 캠페인 시작」이 나가기 전에 부른다. */
export function discardSavedCampaignRun(): void {
  const storage = browserCampaignStorage();
  if (storage !== null) clearCampaignRun(storage);
}
