import { expect, type Page } from "@playwright/test";

export interface BrowserFailure {
  readonly kind: "pageerror" | "console.error";
  readonly message: string;
}

export function watchBrowserErrors(page: Page): BrowserFailure[] {
  const failures: BrowserFailure[] = [];

  page.on("pageerror", (error) => {
    failures.push({ kind: "pageerror", message: error.stack ?? error.message });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({ kind: "console.error", message: message.text() });
    }
  });

  return failures;
}

export function expectNoBrowserErrors(
  failures: readonly BrowserFailure[],
  context: string,
): void {
  expect(failures, `${context} 브라우저 오류`).toEqual([]);
}
