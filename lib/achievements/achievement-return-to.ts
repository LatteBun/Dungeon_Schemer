export function safeAchievementReturnTo(
  value: string | readonly string[] | undefined,
): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";

  try {
    const base = new URL("https://dungeon-schemer.local");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return "/";
    if (destination.pathname.startsWith("/achievements")) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
