import { CAMPAIGN_RUN_STORAGE_KEY } from "@/lib/store/campaign-run-storage";

export const APP_STORAGE_PREFIX = "dungeon-schemer.";

export interface DiagnosticStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

export interface StorageDiagnosticEntry {
  readonly key: string;
  readonly format: "json" | "invalid-json";
  readonly raw: string;
  readonly display: string;
}

export interface CampaignStorageSummary {
  readonly seed: string;
  readonly actionCount: number;
  readonly latestActionType: string | null;
}

export interface StorageDiagnosticSnapshot {
  readonly version: 1;
  readonly collectedAt: string;
  readonly userAgent: string;
  readonly status: "ready" | "unavailable";
  readonly reason: string | null;
  readonly campaign: CampaignStorageSummary | null;
  readonly entries: readonly StorageDiagnosticEntry[];
}

interface DiagnosticContext {
  readonly collectedAt: string;
  readonly userAgent: string;
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function entryFor(key: string, raw: string): StorageDiagnosticEntry {
  try {
    const parsed: unknown = JSON.parse(raw);
    return { key, raw, format: "json", display: JSON.stringify(parsed, null, 2) };
  } catch {
    return { key, raw, format: "invalid-json", display: raw };
  }
}

function campaignSummary(entry: StorageDiagnosticEntry | undefined): CampaignStorageSummary | null {
  if (entry === undefined || entry.format !== "json") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as { seed?: unknown; actions?: unknown };
  if (typeof candidate.seed !== "string" || candidate.seed.length === 0 || !Array.isArray(candidate.actions)) {
    return null;
  }
  const latest = candidate.actions.at(-1);
  const latestActionType = typeof latest === "object"
    && latest !== null
    && typeof (latest as { type?: unknown }).type === "string"
    ? (latest as { type: string }).type
    : null;
  return { seed: candidate.seed, actionCount: candidate.actions.length, latestActionType };
}

export function collectStorageDiagnostics(
  storage: DiagnosticStorage,
  context: DiagnosticContext,
): StorageDiagnosticSnapshot {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(APP_STORAGE_PREFIX)) keys.push(key);
    }
    const entries = [...new Set(keys)].sort().flatMap((key) => {
      const raw = storage.getItem(key);
      return raw === null ? [] : [entryFor(key, raw)];
    });
    return {
      version: 1,
      ...context,
      status: "ready",
      reason: null,
      campaign: campaignSummary(entries.find(({ key }) => key === CAMPAIGN_RUN_STORAGE_KEY)),
      entries,
    };
  } catch (error) {
    return {
      version: 1,
      ...context,
      status: "unavailable",
      reason: reasonFor(error),
      campaign: null,
      entries: [],
    };
  }
}

export function formatStorageDiagnostics(snapshot: StorageDiagnosticSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
