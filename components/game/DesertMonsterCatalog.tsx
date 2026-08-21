import { DESERT_MONSTER_ASSETS } from "./DesertMonsterAssets";

function AssetSection({
  title,
  kind,
}: {
  title: string;
  kind: "monster" | "boss";
}) {
  const assets = DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === kind);

  return (
    <section className="desert-monster-catalog__section" aria-labelledby={`desert-${kind}-title`}>
      <div className="desert-monster-catalog__section-heading">
        <p>{kind === "boss" ? "위험도 구간별 보스" : "공식 사막 생태"}</p>
        <h2 id={`desert-${kind}-title`}>{title}</h2>
      </div>
      <div className="desert-monster-catalog__grid">
        {assets.map((asset) => (
          <article className={`desert-monster-card desert-monster-card--${kind}`} key={asset.id}>
            <div className="desert-monster-card__art">
              <img src={asset.src} alt={`${asset.name} 검수 에셋`} loading="eager" />
            </div>
            <div className="desert-monster-card__copy">
              <span className="desert-monster-card__kind">{kind === "boss" ? "BOSS" : "MONSTER"}</span>
              <h3>{asset.name}</h3>
              <code>{asset.id}</code>
              <p>{asset.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DesertMonsterCatalog() {
  return (
    <main className="desert-monster-catalog">
      <header className="desert-monster-catalog__header">
        <p>Dungeon Schemer · Asset Review</p>
        <h1>사막 몬스터 에셋 검수</h1>
        <span>
          공식 사막 생태와 보스 설정을 기준으로 만든 1:1 투명 전신 에셋입니다. 실제 전투에서는
          object-fit: contain으로 배치합니다.
        </span>
      </header>
      <AssetSection title="일반 몬스터 5종" kind="monster" />
      <AssetSection title="보스 4종" kind="boss" />
    </main>
  );
}
