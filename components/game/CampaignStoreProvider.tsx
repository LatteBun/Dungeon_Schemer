"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { CampaignStore, CampaignStoreState } from "@/lib/store/campaign-store";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { restoreCampaignRun } from "@/lib/store/campaign-run-restore";
import {
  CAMPAIGN_RUN_VERSION,
  saveCampaignRun,
  type StringStorage,
} from "@/lib/store/campaign-run-storage";

/**
 * 브라우저 저장을 꺼낸다.
 *
 * 서버에는 없고, 사생활 보호 모드에서는 접근 자체가 던진다. 둘 다 저장 없이
 * 노는 것으로 물러선다 — 이어하기를 못 할 뿐 캠페인은 시작되어야 한다.
 */
function browserStorage(): StringStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 캠페인 스토어를 트리에 건다.
 *
 * 스토어 자체는 React 밖에 있고 여기서는 인스턴스만 전달한다. 모듈 전역으로
 * 두지 않는 이유는 서버에서 요청들이 하나를 나눠 쓰면 다른 사람의 캠페인이
 * 새어 나오기 때문이다.
 */

const StoreContext = createContext<CampaignStore | null>(null);

export function CampaignStoreProvider({ seed, children, store: providedStore, explicitSeed = false }: {
  readonly seed: string;
  readonly children: React.ReactNode;
  readonly store?: CampaignStore;
  /**
   * 주소가 시드를 직접 골랐는가.
   *
   * `?seed=...` 는 같은 판을 다시 만들려고 쓰는 재현용 경로다. 그 요청에
   * 저장을 끼워 넣으면 부탁한 판이 아니라 이어하던 판이 서서, 결함 재현과
   * 자동 테스트가 조용히 다른 것을 보게 된다.
   */
  readonly explicitSeed?: boolean;
}) {
  /*
   * 한 번만 만든다. 매 렌더마다 새로 만들면 캠페인이 계속 처음으로 돌아간다.
   *
   * `useRef` 로 지연 생성하는 흔한 방법은 렌더 중에 ref 를 읽어야 해서 React 19
   * 에서 막힌다. `useState` 의 초기화 함수는 첫 렌더에서 한 번만 돈다.
   */
  /*
   * 저장은 조작이 성공할 때마다 덮어쓴다.
   *
   * 스토어를 만들 때 붙여야 첫 조작부터 남는다. 화면이 저장을 부르게 하면 부르지
   * 않는 화면이 생기고, 그 화면을 지나온 판만 이어할 수 없게 된다.
   */
  const [store] = useState(() => providedStore ?? createCampaignStore(seed, (runSeed, actions) => {
    const storage = browserStorage();
    if (storage === null) return;
    saveCampaignRun(storage, { version: CAMPAIGN_RUN_VERSION, seed: runSeed, actions });
  }));

  /*
   * 되살리기는 첫 렌더가 아니라 effect 에서 한다.
   *
   * 서버는 저장을 볼 수 없으므로 언제나 새 캠페인을 그린다. 클라이언트가 첫
   * 렌더에서 되살린 판을 그리면 서버가 보낸 것과 달라져 hydration 이 어긋난다.
   * 붙은 뒤에 갈아 끼우면 한 번 더 그릴 뿐 어긋나지 않는다.
   *
   * `providedStore` 를 받은 자리는 건드리지 않는다. 프리뷰와 테스트가 스스로
   * 상태를 정해 넘기는 자리라 저장이 끼어들면 안 된다.
   */
  useEffect(() => {
    if (providedStore !== undefined || explicitSeed) return;
    const storage = browserStorage();
    if (storage === null) return;

    const restored = restoreCampaignRun(storage);
    if (restored.status !== "restored") return;
    store.getState().restore(restored.run.seed, restored.state, restored.run.actions);
  }, [store, providedStore, explicitSeed]);

  /*
   * 뒤로가기로 되살아난 문서를 다시 그린다.
   *
   * 브라우저가 bfcache 로 문서를 통째로 되살리면 React 상태가 그대로 남는다.
   * 그때 화면은 낡은 그림을 들고 있는데 스토어는 현재 상태를 안다. 다시 그리게
   * 해서 둘을 맞춘다. 이것이 첫 겹이고, `phase` 라우팅이 둘째 겹, `C7` 의
   * 전이 거부가 셋째 겹이다.
   */
  const [, redraw] = useState(0);
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) redraw((count) => count + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => { window.removeEventListener("pageshow", onShow); };
  }, []);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useCampaignStore<T>(selector: (state: CampaignStoreState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error("CampaignStoreProvider 안에서만 쓸 수 있다");
  return useStore(store, selector);
}
