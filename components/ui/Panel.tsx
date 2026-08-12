import type { ReactNode } from "react";

interface PanelProps {
  /** 없으면 제목 줄을 그리지 않는다. */
  title?: string;
  /** 제목 오른쪽에 놓는 보조 정보다. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * 화면 영역의 공통 껍데기다.
 * 게임을 모르는 프리미티브이므로 @/lib/domain 을 가져오지 않는다.
 * eslint 의 no-restricted-imports 가 이 경계를 강제한다.
 */
export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section
      className={`flex flex-col rounded border border-edge bg-panel${
        className === undefined ? "" : ` ${className}`
      }`}
    >
      {title === undefined ? null : (
        <header className="flex items-baseline justify-between gap-2 border-b border-edge px-3 py-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted">
            {title}
          </h2>
          {aside}
        </header>
      )}
      <div className="flex-1 p-3">{children}</div>
    </section>
  );
}
