import { describe, expect, it } from "vitest";
import type { CampaignTransition } from "@/lib/domain";
import {
  CAMPAIGN_RUN_CORRUPT_BACKUP_KEY,
  CAMPAIGN_RUN_STORAGE_KEY,
  CAMPAIGN_RUN_VERSION,
  clearCampaignRun,
  clearSavedCampaignRun,
  loadCampaignRun,
  quarantineCampaignRun,
  saveCampaignRun,
  type StringStorage,
} from "./campaign-run-storage";
import { advanceRun, initialRunState, replayRun } from "./campaign-run";
import { createCampaignStore } from "./campaign-store";

function memoryStorage(seed: Record<string, string> = {}): StringStorage & { readonly map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

function failingStorage(error: Error): StringStorage {
  return {
    getItem() { throw error; },
    setItem() { throw error; },
    removeItem() { throw error; },
  };
}

function stickyStorage(key: string, value: string): StringStorage {
  return {
    getItem: (candidate) => candidate === key ? value : null,
    setItem() {},
    removeItem() {},
  };
}

function backupFailingStorage(seed: Record<string, string>): StringStorage & { readonly map: Map<string, string> } {
  const storage = memoryStorage(seed);
  return {
    ...storage,
    setItem(key, value) {
      if (key === CAMPAIGN_RUN_CORRUPT_BACKUP_KEY) throw new Error("백업 거부됨");
      storage.setItem(key, value);
    },
  };
}

function clearFailingStorage(seed: Record<string, string>): StringStorage & { readonly map: Map<string, string> } {
  const storage = memoryStorage(seed);
  return {
    ...storage,
    removeItem(key) {
      if (key === CAMPAIGN_RUN_STORAGE_KEY) throw new Error("삭제 거부됨");
      storage.removeItem(key);
    },
  };
}

const OPEN_BOARD: CampaignTransition = { type: "OPEN_BOARD" };

describe("캠페인 저장 읽고 쓰기", () => {
  it("적은 것을 그대로 되읽는다", () => {
    const storage = memoryStorage();
    const run = { version: CAMPAIGN_RUN_VERSION, seed: "seed-a", actions: [OPEN_BOARD] };

    expect(saveCampaignRun(storage, run)).toEqual({ ok: true });
    const loaded = loadCampaignRun(storage);

    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.run.seed).toBe("seed-a");
    expect(loaded.run.actions).toEqual([OPEN_BOARD]);
  });

  it("저장이 없으면 비었다고 답한다", () => {
    expect(loadCampaignRun(memoryStorage()).status).toBe("empty");
  });

  it("지우면 비어진다", () => {
    const storage = memoryStorage();
    saveCampaignRun(storage, { version: CAMPAIGN_RUN_VERSION, seed: "s", actions: [] });
    clearCampaignRun(storage);
    expect(loadCampaignRun(storage).status).toBe("empty");
  });

  it("캠페인 저장만 지우고 삭제 성공을 반환한다", () => {
    const storage = memoryStorage({
      [CAMPAIGN_RUN_STORAGE_KEY]: JSON.stringify({ version: 1, seed: "old", actions: [] }),
      "dungeon-schemer.player-progress.v1": "achievement",
    });

    expect(clearSavedCampaignRun(storage)).toEqual({ ok: true });
    expect(storage.getItem(CAMPAIGN_RUN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("dungeon-schemer.player-progress.v1")).toBe("achievement");
  });

  it("remove 뒤 캠페인 키가 남으면 삭제 실패를 반환한다", () => {
    expect(clearSavedCampaignRun(stickyStorage(CAMPAIGN_RUN_STORAGE_KEY, "saved"))).toEqual({
      ok: false,
      reason: "캠페인 저장이 남아 있다",
    });
  });

  it("캠페인 삭제 접근이 막히면 이유를 반환한다", () => {
    expect(clearSavedCampaignRun(failingStorage(new Error("거부됨")))).toEqual({
      ok: false,
      reason: "거부됨",
    });
  });

  /*
   * 아래 넷은 전부 「쓸 수 없다」로 끝나야 한다. 무엇이든 캠페인을 시작하지
   * 못하게 만들면 안 되고, 반대로 이상한 저장을 믿고 되살려서도 안 된다.
   */
  it("깨진 JSON 을 쓸 수 없다고 본다", () => {
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: "{{{" });
    const loaded = loadCampaignRun(storage);
    expect(loaded.status).toBe("unusable");
    if (loaded.status === "unusable") expect(loaded.raw).toBe("{{{");
  });

  it("시드가 없으면 쓸 수 없다고 본다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION, actions: [] });
    const loaded = loadCampaignRun(memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw }));
    expect(loaded.status).toBe("unusable");
  });

  it("액션 기록이 배열이 아니면 쓸 수 없다고 본다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION, seed: "s", actions: "nope" });
    const loaded = loadCampaignRun(memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw }));
    expect(loaded.status).toBe("unusable");
  });

  /*
   * 미래 버전을 덮어쓰지 않는다. 새 코드가 쓴 저장을 옛 코드가 열었을 때
   * 지워 버리면 브라우저를 되돌린 사람이 진행을 잃는다.
   */
  it("미래 버전을 지원하지 않는 저장으로 구분하고 원문을 보존한다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION + 1, seed: "s", actions: [] });
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw });

    expect(loadCampaignRun(storage)).toEqual({
      status: "unsupported",
      version: CAMPAIGN_RUN_VERSION + 1,
      raw,
    });
    expect(storage.map.get(CAMPAIGN_RUN_STORAGE_KEY)).toBe(raw);
  });

  /*
   * 사생활 보호 모드와 용량 초과에서 `localStorage` 가 던진다. 그때 캠페인이
   * 멈추면 안 된다 — 이번 판을 이어할 수 없을 뿐이다.
   */
  it("저장이 막혀도 던지지 않고 이유를 돌려준다", () => {
    const result = saveCampaignRun(failingStorage(new Error("거부됨")), {
      version: CAMPAIGN_RUN_VERSION, seed: "s", actions: [],
    });
    expect(result).toEqual({ ok: false, reason: "거부됨" });
  });

  it("읽기가 막혀도 던지지 않는다", () => {
    expect(loadCampaignRun(failingStorage(new Error("거부됨"))).status).toBe("unusable");
  });

  it("지우기가 막혀도 던지지 않는다", () => {
    expect(() => { clearCampaignRun(failingStorage(new Error("거부됨"))); }).not.toThrow();
  });

  it("ready 저장도 복원할 원문을 함께 반환한다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION, seed: "saved", actions: [OPEN_BOARD] });

    expect(loadCampaignRun(memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw }))).toMatchObject({
      status: "ready",
      raw,
    });
  });

  it("복원 실패 원문을 최신 백업으로 격리하고 캠페인 진행만 지운다", () => {
    const raw = "{damaged}";
    const storage = memoryStorage({
      [CAMPAIGN_RUN_STORAGE_KEY]: raw,
      [CAMPAIGN_RUN_CORRUPT_BACKUP_KEY]: "old backup",
      "dungeon-schemer.player-progress.v1": "achievement",
      "dungeon-schemer.player-progress.corrupt-backup": "achievement backup",
      "dungeon-schemer.audio-settings.v1": "audio",
      "outside-app": "outside",
    });

    expect(quarantineCampaignRun(storage, {
      raw,
      reason: "Cannot read properties of undefined",
      failedAt: 2,
      capturedAt: "2026-08-26T13:00:00.000Z",
    })).toEqual({ backup: { ok: true }, clear: { ok: true } });
    expect(JSON.parse(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)!)).toEqual({
      version: 1,
      capturedAt: "2026-08-26T13:00:00.000Z",
      reason: "Cannot read properties of undefined",
      failedAt: 2,
      raw,
    });
    expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
    expect(Object.fromEntries(storage.map)).toMatchObject({
      "dungeon-schemer.player-progress.v1": "achievement",
      "dungeon-schemer.player-progress.corrupt-backup": "achievement backup",
      "dungeon-schemer.audio-settings.v1": "audio",
      "outside-app": "outside",
    });
  });

  it("백업 저장이 막혀도 캠페인 진행 삭제를 계속 시도한다", () => {
    const storage = backupFailingStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: "{damaged}" });

    expect(quarantineCampaignRun(storage, { raw: "{damaged}", reason: "broken", failedAt: null })).toEqual({
      backup: { ok: false, reason: "백업 거부됨" },
      clear: { ok: true },
    });
    expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
  });

  it("캠페인 진행 삭제가 막혀도 격리 결과만 반환한다", () => {
    const storage = clearFailingStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: "{damaged}" });

    expect(quarantineCampaignRun(storage, {
      raw: "{damaged}", reason: "broken", failedAt: null, capturedAt: "2026-08-26T13:00:00.000Z",
    })).toEqual({
      backup: { ok: true },
      clear: { ok: false, reason: "삭제 거부됨" },
    });
    expect(storage.map.get(CAMPAIGN_RUN_STORAGE_KEY)).toBe("{damaged}");
  });
});

describe("캠페인 되살리기", () => {
  /*
   * 이 게임이 이어하기를 상태 통째로가 아니라 시드와 액션으로 하는 근거다.
   * 같은 시드에 같은 액션을 넣으면 같은 캠페인이 서야 한다.
   */
  it("같은 시드에 같은 액션이면 처음부터 한 판과 같아진다", () => {
    const played = advanceRun(initialRunState("seed-b"), OPEN_BOARD);
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const replayed = replayRun("seed-b", [OPEN_BOARD]);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;

    expect(replayed.state.campaign).toEqual(played.state.campaign);
  });

  it("액션이 없으면 새 캠페인 그대로다", () => {
    const replayed = replayRun("seed-c", []);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state.campaign).toEqual(initialRunState("seed-c").campaign);
  });

  /*
   * 규칙이 바뀌면 옛 저장이 여기로 온다. 막힌 앞까지만 살리면 플레이어가 겪지
   * 않은 지점으로 되돌려 놓게 되므로 전부 버린다.
   */
  it("규칙이 거부하는 액션을 만나면 일부만 살리지 않고 실패로 끝낸다", () => {
    const bogus: CampaignTransition = { type: "CHOOSE_ADVICE", adviceId: "없는-조언" as never };
    const replayed = replayRun("seed-d", [bogus]);

    expect(replayed.ok).toBe(false);
    if (replayed.ok) return;
    expect(replayed.failedAt).toBe(0);
  });

  it("저장 replay의 일반 예외를 실패 위치로 반환한다", () => {
    const opened = advanceRun(initialRunState("damaged"), OPEN_BOARD);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const actions = [
      OPEN_BOARD,
      { type: "SELECT_CONTRACT", offerId: opened.state.campaign.offers[0]!.id },
      { type: "START_EXPEDITION", expeditionId: "broken" },
    ] as unknown as CampaignTransition[];

    expect(replayRun("damaged", actions)).toMatchObject({
      ok: false,
      failedAt: 2,
    });
  });
});

describe("스토어가 남기는 기록", () => {
  it("성공한 조작만 기록한다", () => {
    const store = createCampaignStore("seed-e");

    store.getState().dispatch(OPEN_BOARD);
    const afterGood = store.getState().recordedActions().length;

    /* 게시판에 없는 공고다. 규칙이 거부하므로 기록에 남으면 안 된다. */
    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: "없는-공고" as never });

    expect(store.getState().rejected).not.toBeNull();
    expect(store.getState().recordedActions()).toHaveLength(afterGood);
  });

  it("조작이 성공할 때마다 저장하라고 알린다", () => {
    const seen: { seed: string; count: number }[] = [];
    const store = createCampaignStore("seed-f", (seed, actions) => {
      seen.push({ seed, count: actions.length });
    });

    store.getState().dispatch(OPEN_BOARD);

    expect(seen).toEqual([{ seed: "seed-f", count: 1 }]);
  });

  /*
   * `/campaign` 은 들어올 때마다 새 시드를 뽑는다. 되살린 뒤에도 그 시드를
   * 들고 있으면, 다음 저장이 판과 다른 시드를 적어 새로고침에서 아주 다른
   * 캠페인이 선다.
   */
  it("되살린 뒤에는 만들어질 때 받은 시드가 아니라 되살린 시드를 적는다", () => {
    const seen: string[] = [];
    const store = createCampaignStore("새로-뽑힌-시드", (seed) => { seen.push(seed); });

    const replayed = replayRun("저장된-시드", []);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    store.getState().restore("저장된-시드", replayed.state, []);

    store.getState().dispatch(OPEN_BOARD);

    expect(store.getState().rejected).toBeNull();
    expect(seen).toEqual(["저장된-시드"]);
    expect(store.getState().recordedActions()).toHaveLength(1);
  });
});

/*
 * 엔딩 화면의 「새 캠페인 시작」이 하는 일이다.
 *
 * 그 화면은 이미 `/campaign` 이라 주소로는 새 판을 세울 수 없고, 문서를 새로
 * 부르면 휴대폰에서 전체 화면과 가로 잠금이 풀린다. 스토어를 갈아 끼우는 것이
 * 유일한 길이므로, 그 한 걸음이 실제로 새 판을 세우는지 고정한다.
 *
 * 엔딩까지 실제로 몰고 가지는 않는다. 캠페인 하나를 끝내려면 원정을 여러 번
 * 돌려야 해서 이 자리에 두기에 무겁고, 무엇보다 `restore` 는 앞선 상태가
 * 무엇이든 통째로 갈아 끼우므로 진행 중인 판으로 확인해도 같은 것을 지킨다.
 */
describe("진행하던 판에서 새 판으로 갈아 끼우기", () => {
  /** 인트로를 벗어나 공고 하나를 고른 상태까지 몬다. */
  function inProgress(seed: string) {
    const store = createCampaignStore(seed);
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const offer = store.getState().campaign.offers.find((one) => one.lockReason === null);
    if (offer !== undefined) store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer.id });
    return store;
  }

  it("진행하던 판을 인트로로 되돌리고 기록을 비운다", () => {
    const store = inProgress("reset-a");
    const before = store.getState().campaign;

    /* 정말 움직인 판인지 먼저 확인한다. 아니면 이 검사는 아무것도 지키지 못한다. */
    expect(before.phase).not.toBe("intro");
    expect(store.getState().recordedActions().length).toBeGreaterThan(0);

    const seed = "갈아-끼운-시드";
    store.getState().restore(seed, initialRunState(seed), []);

    const after = store.getState().campaign;
    expect(after.phase).toBe("intro");
    expect(after.ending).toBeNull();
    expect(after.seed).toBe(seed);
    expect(after.seed).not.toBe(before.seed);
    expect(store.getState().recordedActions()).toHaveLength(0);
  });

  it("갈아 끼운 판은 처음부터 시작한 판과 같다", () => {
    const store = inProgress("reset-b");
    const seed = "같은-시드";
    store.getState().restore(seed, initialRunState(seed), []);

    expect(store.getState().campaign).toEqual(initialRunState(seed).campaign);
  });

  /* 갈아 끼운 뒤의 첫 조작은 새 시드로 저장되어야 한다. */
  it("갈아 끼운 뒤 저장은 새 시드를 적는다", () => {
    const seen: string[] = [];
    const store = createCampaignStore("옛-시드", (runSeed) => { seen.push(runSeed); });
    store.getState().dispatch({ type: "OPEN_BOARD" });

    const seed = "새-시드";
    store.getState().restore(seed, initialRunState(seed), []);
    store.getState().dispatch({ type: "OPEN_BOARD" });

    expect(seen).toEqual(["옛-시드", "새-시드"]);
  });
});
