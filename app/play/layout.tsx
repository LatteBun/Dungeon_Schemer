import type { ReactNode } from "react";
import { PlayChrome } from "./play-chrome";
import { PlayRunProvider } from "./play-run-provider";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return (
    <PlayRunProvider>
      <PlayChrome>{children}</PlayChrome>
    </PlayRunProvider>
  );
}
