export interface DiagnosticTriggerState {
  readonly count: number;
  readonly startedAt: number | null;
}

export interface DiagnosticTriggerResult {
  readonly state: DiagnosticTriggerState;
  readonly open: boolean;
}

const TRIGGER_CLICK_COUNT = 5;
const TRIGGER_WINDOW_MS = 2_000;

export function initialDiagnosticTriggerState(): DiagnosticTriggerState {
  return { count: 0, startedAt: null };
}

export function advanceDiagnosticTrigger(
  state: DiagnosticTriggerState,
  now: number,
): DiagnosticTriggerResult {
  const expired = state.startedAt === null || now - state.startedAt > TRIGGER_WINDOW_MS;
  const startedAt = expired ? now : state.startedAt;
  const count = expired ? 1 : state.count + 1;

  return count === TRIGGER_CLICK_COUNT
    ? { state: initialDiagnosticTriggerState(), open: true }
    : { state: { count, startedAt }, open: false };
}
