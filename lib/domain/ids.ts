declare const brand: unique symbol;

/**
 * 같은 string이지만 서로 섞이지 않는 ID 타입을 만든다.
 * brand는 타입 수준에만 존재하므로 런타임 비용이 없다.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MemberId = Brand<string, "MemberId">;
export type ClassId = Brand<string, "ClassId">;
export type CardId = Brand<string, "CardId">;
export type EventId = Brand<string, "EventId">;
export type NodeId = Brand<string, "NodeId">;
export type ChoiceId = Brand<string, "ChoiceId">;
export type ClaimId = Brand<string, "ClaimId">;
export type ItemId = Brand<string, "ItemId">;
