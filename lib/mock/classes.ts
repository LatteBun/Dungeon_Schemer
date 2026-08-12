import type { ClassDef, ClassId } from "@/lib/domain";

/** 직업은 열린 목록이므로 콘텐츠 데이터다. Q1이 실제 데이터 파일로 옮긴다. */
export const MOCK_CLASSES: ClassDef[] = [
  { id: "c-warrior" as ClassId, name: "전사", description: "앞에서 버티며 파티의 피해를 받아낸다." },
  { id: "c-cleric" as ClassId, name: "성직자", description: "치유를 맡고 파티의 규율을 따진다." },
  { id: "c-rogue" as ClassId, name: "도적", description: "잠금과 함정을 다루고 자기 몫을 챈다." },
  { id: "c-mage" as ClassId, name: "마법사", description: "화력을 내지만 오래 버티지 못한다." },
  { id: "c-ranger" as ClassId, name: "궁수", description: "거리를 두고 길과 흔적을 읽는다." },
];
