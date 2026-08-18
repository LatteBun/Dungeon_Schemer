import { join } from "node:path";
import { describeWorkAssignment } from "./work-assignment-integrity";

/**
 * 개편 이전 배정표의 무결성 검사.
 *
 * 이 배정표는 완료 상태로 동결했지만 검사는 남겨 둔다. 동결한 표가
 * 나중에 손질되면서 조용히 틀어지는 것을 막는다.
 *
 * 검사 규약은 캠페인 개편 배정표와 같으므로 공유 모듈이 담당한다.
 */
describeWorkAssignment(
  "개편 이전 배정표",
  join(import.meta.dirname, "PROTOTYPE_WORK_ASSIGNMENT.md"),
);
