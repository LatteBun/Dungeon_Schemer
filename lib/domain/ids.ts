declare const brand: unique symbol;

/**
 * 같은 string이지만 서로 섞이지 않는 ID 타입을 만든다.
 * brand는 타입 수준에만 존재하므로 런타임 비용이 없다.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type CharacterId = Brand<string, "CharacterId">;
export type ClassId = Brand<string, "ClassId">;
export type CardId = Brand<string, "CardId">;
export type EventId = Brand<string, "EventId">;
export type NodeId = Brand<string, "NodeId">;
export type ChoiceId = Brand<string, "ChoiceId">;
export type ClaimId = Brand<string, "ClaimId">;
export type ItemId = Brand<string, "ItemId">;
export type BossId = Brand<string, "BossId">;
export type DungeonId = Brand<string, "DungeonId">;
export type OfferId = Brand<string, "OfferId">;

/** 생태 규칙 한 줄. 카드가 이 ID로 자기가 참조하는 규칙을 가리킨다. */
export type RuleId = Brand<string, "RuleId">;
export type MonsterId = Brand<string, "MonsterId">;
export type EcologyProfileId = Brand<string, "EcologyProfileId">;

/** 상황 묘사가 남기는 관찰 결과. 약한 연계와 강한 연계의 유일한 화폐다. */
export type ClueId = Brand<string, "ClueId">;
