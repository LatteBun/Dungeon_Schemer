import { describe, expect, it } from "vitest";
import type { MemberId } from "@/lib/domain";
import { createUiStore } from "@/lib/stores/ui-store";

const memberId = "ui-member" as MemberId;

describe("화면 상태 스토어", () => {
  it("선택된 파티원 없이 시작한다", () => {
    const store = createUiStore();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("파티원을 선택한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);

    expect(store.getState().selectedMemberId).toBe(memberId);
  });

  it("선택을 해제한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().clearSelectedMember();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("UI 상태를 초기화한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().resetUi();

    expect(store.getState().selectedMemberId).toBeNull();
  });
});
