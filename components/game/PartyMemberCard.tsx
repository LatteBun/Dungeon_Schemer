/**
 * 파티원 카드 — 파티 상태를 보여주는 모든 화면이 함께 쓴다.
 *
 * U3·U4·U5 가 각자 카드를 그리면서 항목 순서와 표시가 갈렸다. 같은 파티원이
 * 화면마다 다르게 보이면 플레이어가 자리를 다시 배운다. 한 곳에 둔다.
 *
 * 카드 셋을 가로로 나란히 두고, 카드 안에서는 초상을 위에 크게 깐 뒤 정보를
 * 그 아래 둔다. 파티는 정확히 3명이라(EXPEDITION_PARTY_SIZE) 3열이 넘치거나
 * 모자라지 않는다. 원정 중 사망해도 슬롯은 셋 그대로다.
 *
 * HP 와 신뢰는 가로로 나란히 두지 않고 세로로 쌓아 각자 막대가 폭을 온전히
 * 쓰게 한다. 소지 골드는 라벨 문구 없이 아이콘과 금액을 붙여 둔다. 골드는
 * 이름을 붙이지 않아도 아이콘으로 읽힌다.
 */

export interface PartyMemberCardView {
  id: string;
  name: string;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
  /** 초상 자산이 없는 화면은 비운다. 자리는 남긴다. */
  portraitSrc?: string;
  /** 원정 중이 아닌 화면은 항상 살아 있다. */
  alive?: boolean;
}

export interface PartyMemberCardProps {
  member: PartyMemberCardView;
  /** 화면별 접두사. U3 는 순번을 함께 보여준다. */
  index?: number;
  testId?: string;
}

const GOLD_ICON = "/assets/u2/status-gold.svg";

function percent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function PartyMemberCard({ member, index, testId }: PartyMemberCardProps) {
  const alive = member.alive ?? true;

  return (
    <article
      className={`party-card${alive ? "" : " is-dead"}`}
      data-testid={testId ?? "party-member"}
    >
      <div className="party-card__portrait" aria-hidden={member.portraitSrc === undefined}>
        {index === undefined ? null : (
          <span className="party-card__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {member.portraitSrc === undefined ? (
          <span className="party-card__portrait-empty" />
        ) : (
          <img src={member.portraitSrc} alt={`${member.name} 초상`} />
        )}
        {alive ? null : <strong className="party-card__death">사망</strong>}
      </div>

      <div className="party-card__content">
        <header className="party-card__identity">
          <strong>{member.name}</strong>
          <span>{member.classLabel}</span>
          <small>{member.personalityLabel}</small>
        </header>

        {/* HP 와 신뢰는 세로로 쌓는다. 막대가 폭을 온전히 써야 눈금이 읽힌다. */}
        <dl className="party-card__stats">
          <div className="party-card__stat">
            <dt>HP</dt>
            <dd>
              {member.hp} / {member.maxHp}
            </dd>
            <span className="party-meter" aria-hidden="true">
              <i style={{ width: `${alive ? percent(member.hp, member.maxHp) : 0}%` }} />
            </span>
          </div>

          <div className="party-card__stat">
            <dt>신뢰</dt>
            <dd>{member.trust}</dd>
            <span className="party-meter party-meter--trust" aria-hidden="true">
              <i style={{ width: `${percent(member.trust, 100)}%` }} />
            </span>
          </div>

          {/* 라벨 문구를 두지 않는다. 아이콘과 금액이 붙어 있으면 읽힌다. */}
          <div className="party-card__gold">
            <dt>
              <img src={GOLD_ICON} alt="소지 골드" width={16} height={16} />
            </dt>
            <dd>{member.gold}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
