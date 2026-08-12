import Link from "next/link";
import { ResultSummary } from "@/components/game/ResultSummary";
import { Panel } from "@/components/ui/Panel";
import { MOCK_SETTLEMENT } from "@/lib/mock";

export default function ResultPage() {
  return <Panel title="결과 정산" aside={<Link href="/play" className="text-xs text-muted underline hover:text-parchment">처음으로</Link>} className="flex-1"><ResultSummary settlement={MOCK_SETTLEMENT} /></Panel>;
}
