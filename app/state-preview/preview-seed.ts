export function normalizePreviewSeed(input: string): string | null {
  const seed = input.trim();
  return seed === "" ? null : seed;
}
