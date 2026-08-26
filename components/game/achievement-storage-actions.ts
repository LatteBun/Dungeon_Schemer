import {
  clearSavedCampaignRun,
  type SaveResult,
  type StringStorage,
} from "@/lib/store/campaign-run-storage";

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function copyStorageDiagnostics(
  clipboard: { writeText(text: string): Promise<void> },
  text: string,
): Promise<SaveResult> {
  try {
    await clipboard.writeText(text);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

export function resetCampaignForDiagnostics(
  storage: StringStorage,
  navigate: (href: string) => void,
): SaveResult {
  const result = clearSavedCampaignRun(storage);
  if (!result.ok) return result;
  navigate("/campaign");
  return { ok: true };
}
