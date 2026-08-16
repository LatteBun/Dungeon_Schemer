import { Panel } from "@/components/ui/Panel";
import { EVENT_KIND_MARKS } from "./labels";

/**
 * 보스방은 기호가 아니라 도형으로 구분한다.
 * EVENT_KIND_MARKS.special 과 보스의 categoryMark 가 둘 다 ★ 라서
 * 기호만으로는 같은 표시가 두 뜻을 갖는다.
 */
export function MapLegend() {
  return (
    <Panel title="범례">
      <ul className="flex flex-col gap-1 text-xs text-muted">
        <li>◎ 현재 위치</li>
        <li>✓ 방문 완료</li>
        <li>→ 선택 가능</li>
        <li>× 비활성</li>
        <li className="mt-2">{EVENT_KIND_MARKS.monster} 몬스터</li>
        <li>{EVENT_KIND_MARKS.rest} 휴식</li>
        <li>{EVENT_KIND_MARKS.merchant} 상인</li>
        <li>{EVENT_KIND_MARKS.special} 특수 사건</li>
        <li>? 정보 전달 기회</li>
        <li className="mt-2">보스방은 별 도형</li>
        <li>그 밖의 지점은 원</li>
        <li className="mt-2">전체 연결·대략 위험·보스 위치 공개</li>
        <li>색 + 기호 + 도형으로 구분</li>
      </ul>
    </Panel>
  );
}
