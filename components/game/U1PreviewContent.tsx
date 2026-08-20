import { Panel } from "@/components/ui/Panel";
import {
  U1_PREVIEW_CHOICES,
  U1_PREVIEW_NOTICES,
  U1_PREVIEW_PARTY,
  U1_PREVIEW_PATH_NODES,
  U1_PREVIEW_SETTLEMENT_STEPS,
} from "./u1-preview-data";
import type { U1PreviewScreen } from "./u1-preview-data";

function ReferencePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title} className="u1-reference-panel">
      {children}
    </Panel>
  );
}

function PartyRoster({ label = "출전 파티" }: { label?: string }) {
  return (
    <section className="u1-reference-panel__section" aria-label={label}>
      <h3 className="u1-reference-panel__eyebrow">{label}</h3>
      <ul className="u1-reference-party-list">
        {U1_PREVIEW_PARTY.map((member) => (
          <li key={member.id} className="u1-reference-party-list__item">
            <div>
              <strong>{member.name} · {member.role}</strong>
              <span>HP {member.currentHp} / {member.maxHp}</span>
            </div>
            <p>신뢰 {member.trust} · {member.reaction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IntroPreview() {
  return (
    <ReferencePanel title="길잡이의 시작">
      <div className="u1-reference-intro">
        <p>직접 싸우지 않고 정보와 선택으로 원정을 이끕니다.</p>
        <p>선택 결과와 변화 원인은 다음 화면에서 확인합니다.</p>
      </div>
    </ReferencePanel>
  );
}

function BoardPreview() {
  return (
    <ReferencePanel title="길드 공고">
      <div className="u1-reference-notice-list">
        {U1_PREVIEW_NOTICES.map((notice, index) => (
          <article key={notice.id} className="u1-reference-notice">
            <div>
              <p className="u1-reference-panel__eyebrow">{notice.area}</p>
              <h3>{notice.title}</h3>
            </div>
            <p>위험 ★{notice.riskLevel} · {notice.status}</p>
            <button type="button" disabled={index !== 0}>
              {index === 0 ? "계약하기 (프리뷰)" : "계약 불가 (프리뷰)"}
            </button>
          </article>
        ))}
      </div>
    </ReferencePanel>
  );
}

function MapPreview() {
  return (
    <ReferencePanel title="던전 경로">
      <ol className="u1-reference-path">
        {U1_PREVIEW_PATH_NODES.map((node, index) => (
          <li key={node.id} className="u1-reference-path__node">
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{node.label}</strong>
              <p>{node.state}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="u1-reference-action" disabled>
        선택 지점 입장 (프리뷰)
      </button>
    </ReferencePanel>
  );
}

function ProgressPreview() {
  return (
    <ReferencePanel title="정찰 장면">
      <div className="u1-reference-scene">
        <p className="u1-reference-panel__eyebrow">상황 설명</p>
        <p>갈라진 석문 너머에서 거미줄이 흔들리고, 파티는 다음 길을 기다립니다.</p>
      </div>
      <div className="u1-reference-choice-grid">
        {U1_PREVIEW_CHOICES.map((choice) => (
          <button key={choice.id} type="button" disabled>
            <strong>{choice.title}</strong>
            <span>{choice.detail}</span>
          </button>
        ))}
      </div>
    </ReferencePanel>
  );
}

function SettlementPreview() {
  return (
    <ReferencePanel title="원정 정산">
      <ol className="u1-reference-settlement-list">
        {U1_PREVIEW_SETTLEMENT_STEPS.map((step) => (
          <li key={step.id}>
            <div>
              <strong>{step.label}</strong>
              <span>{step.value}</span>
            </div>
            <p>{step.reason}</p>
          </li>
        ))}
      </ol>
    </ReferencePanel>
  );
}

export function U1PreviewMainContent({
  screenId,
}: {
  screenId: U1PreviewScreen;
}) {
  switch (screenId) {
    case "board":
      return <BoardPreview />;
    case "map":
      return <MapPreview />;
    case "progress":
      return <ProgressPreview />;
    case "settlement":
      return <SettlementPreview />;
    case "intro":
      return <IntroPreview />;
  }
}

export function U1PreviewRightPanelContent({
  screenId,
}: {
  screenId: U1PreviewScreen;
}) {
  if (screenId === "intro") {
    return null;
  }

  if (screenId === "board") {
    return (
      <ReferencePanel title="계약 상세">
        <div className="u1-reference-contract">
          <p>거미굴 3번 · 위험 ★2</p>
          <p>고대 수로의 정찰 계약을 준비합니다.</p>
        </div>
        <PartyRoster />
        <button type="button" className="u1-reference-action" disabled>
          계약하기 (프리뷰)
        </button>
      </ReferencePanel>
    );
  }

  if (screenId === "map") {
    return (
      <ReferencePanel title="파티 상태">
        <PartyRoster label="이동 중 파티" />
        <p className="u1-reference-note">다음 지점: 정보 · 이동 1</p>
        <button type="button" className="u1-reference-action" disabled>
          선택 지점 입장 (프리뷰)
        </button>
      </ReferencePanel>
    );
  }

  if (screenId === "progress") {
    return (
      <ReferencePanel title="최근 반응">
        <PartyRoster label="파티 반응" />
        <p className="u1-reference-note">선택 카드는 프리뷰에서 비활성화됩니다.</p>
      </ReferencePanel>
    );
  }

  return (
    <ReferencePanel title="보상과 승급">
      <PartyRoster label="귀환 파티" />
      <p className="u1-reference-note">명성 74 / 다음 등급까지 6</p>
      <button type="button" className="u1-reference-action" disabled>
        승급하기 (프리뷰)
      </button>
    </ReferencePanel>
  );
}
