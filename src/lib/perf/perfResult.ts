// Result of a performance calculation. Port of lib/performance/perf_result.dart.
//
// Replaces VBA's mixed Variant returns ("HORS COURBE", "HORS ISA", "H/C",
// "NO DATA" sentinels mixed with Doubles) with a typed status + numeric value.

export type PerfStatus =
  | 'ok'
  | 'outsideIsa'
  | 'outsideChart'
  | 'noData'
  | 'ceiling'
  | 'mtowClamped';

export interface PerfResult {
  /** Only meaningful when status === 'ok' or 'mtowClamped'. */
  value: number;
  status: PerfStatus;
}

export function perfValue(v: number): PerfResult {
  return { value: v, status: 'ok' };
}
export const perfOutsideIsa: PerfResult = { value: NaN, status: 'outsideIsa' };
export const perfOutsideChart: PerfResult = {
  value: NaN,
  status: 'outsideChart',
};
export const perfNoData: PerfResult = { value: NaN, status: 'noData' };
export const perfCeiling: PerfResult = { value: NaN, status: 'ceiling' };
export const perfMtowClamped: PerfResult = {
  value: 11000.0,
  status: 'mtowClamped',
};

export function isOk(r: PerfResult): boolean {
  return r.status === 'ok';
}
export function isUsable(r: PerfResult): boolean {
  return r.status === 'ok' || r.status === 'mtowClamped';
}

/** Short user-facing label, mirroring VBA spreadsheet text. */
export function perfLabel(r: PerfResult): string {
  switch (r.status) {
    case 'ok':
    case 'mtowClamped':
      return r.value.toFixed(0);
    case 'outsideIsa':
      return 'HORS ISA';
    case 'outsideChart':
      return 'HORS COURBE';
    case 'noData':
      return 'NO DATA';
    case 'ceiling':
      return 'H/C';
  }
}
