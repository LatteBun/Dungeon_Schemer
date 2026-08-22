import { Panel } from "@/components/ui/Panel";

/**
 * 캠페인 개편으로 옛 화면을 걷어낸 동안의 자리 표시다.
 *
 * 빈 화면이나 404를 두지 않는 이유가 있다. 저장소를 처음 받은 사람이 무엇이
 * 없는 것인지 알 수 없기 때문이다. 어디까지 왔고 무엇이 다시 채워지는지를
 * 화면이 직접 말한다. `U1`~`U6`이 이 파일을 대체한다.
 */
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">Dungeon Schemer</h1>
        <Panel title="캠페인 개편 진행 중">
          <div className="flex flex-col gap-3 px-3 py-3 text-sm leading-relaxed">
            <p>
              도메인 계약을 캐릭터 풀·위험도·월드턴 모델로 다시 정의하면서 옛 등급
              기반 화면과 규칙을 걷어냈다. 플레이 가능한 화면은 화면 항목이 다시
              만든다.
            </p>
            <p className="text-muted">
              현재 규칙은 <code>docs/systems/</code> 의 공식 문서에 있고, 무엇을
              어떤 순서로 만드는지는{" "}
              <code>docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md</code> 에
              있다. 옛 구현은 git 히스토리에 남아 있다.
            </p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
