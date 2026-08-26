import { describe, expect, it } from "vitest";
import type { CampaignTransition } from "@/lib/domain";
import {
  CAMPAIGN_RUN_STORAGE_KEY,
  CAMPAIGN_RUN_VERSION,
  clearCampaignRun,
  loadCampaignRun,
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
  it("모르는 버전을 덮어쓰지 않고 쓸 수 없다고만 본다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION + 1, seed: "s", actions: [] });
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw });

    expect(loadCampaignRun(storage).status).toBe("unusable");
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
