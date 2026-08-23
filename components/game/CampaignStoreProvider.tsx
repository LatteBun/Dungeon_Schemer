"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { CampaignStore, CampaignStoreState } from "@/lib/store/campaign-store";
import { createCampaignStore } from "@/lib/store/campaign-store";

/**
 * 캠페인 스토어를 트리에 건다.
 *
 * 스토어 자체는 React 밖에 있고 여기서는 인스턴스만 전달한다. 모듈 전역으로
 * 두지 않는 이유는 서버에서 요청들이 하나를 나눠 쓰면 다른 사람의 캠페인이
 * 새어 나오기 때문이다.
 */

const StoreContext = createContext<CampaignStore | null>(null);

export function CampaignStoreProvider({ seed, children }: {
  readonly seed: string;
  readonly children: React.ReactNode;
}) {
  /*
   * 한 번만 만든다. 매 렌더마다 새로 만들면 캠페인이 계속 처음으로 돌아간다.
   *
   * `useRef` 로 지연 생성하는 흔한 방법은 렌더 중에 ref 를 읽어야 해서 React 19
   * 에서 막힌다. `useState` 의 초기화 함수는 첫 렌더에서 한 번만 돈다.
   */
  const [store] = useState(() => createCampaignStore(seed));

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
