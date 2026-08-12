interface StatValueProps {
  label: string;
  value: number | string;
  /** 값 뒤에 붙는 단위나 기호다. */
  suffix?: string;
}

/** 라벨과 값을 한 쌍으로 보여준다. 게임을 모른다. */
export function StatValue({ label, value, suffix }: StatValueProps) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-parchment">
        {value}
        {suffix}
      </span>
    </span>
  );
}
