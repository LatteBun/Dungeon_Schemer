import { join } from "node:path";
import { describeWorkAssignment } from "./work-assignment-integrity";

/**
 * 캠페인 개편 배정표의 무결성 검사.
 *
 * 규약과 검사는 개편 이전 배정표와 같으므로 공유 모듈이 담당하고,
 * 여기서는 어느 문서를 검사할지만 정한다.
 */
describeWorkAssignment(
  "캠페인 개편 배정표",
  join(import.meta.dirname, "CAMPAIGN_REWORK_WORK_ASSIGNMENT.md"),
);
