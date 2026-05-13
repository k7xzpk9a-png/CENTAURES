// Performance chart table model + .dat file loader + 3D interpolation.
// Port of lib/performance/perf_table.dart.
//
// The .dat format encodes one curve per pair of CSV rows: first row's first
// cell is the curve's Z value, subsequent cells are X values; second row's
// cells are Y values. All values are encrypted as 8-char hex tokens decoded
// via (CLng("&H" & token) - 24328) / 1200.

import { linearInterpolation } from './atmosphere';

export interface TablePoint {
  x: number;
  y: number;
}

export interface TableCurve {
  /** Curve "Z" (typically OAT or PA depending on chart family). */
  z: number;
  points: readonly TablePoint[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PerfTable {
  curves: readonly TableCurve[];
  zMin: number;
  zMax: number;
}

export function makeCurve(z: number, points: TablePoint[]): TableCurve {
  if (points.length === 0) {
    return { z, points, xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  }
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { z, points, xMin, xMax, yMin, yMax };
}

function makeTable(curves: TableCurve[]): PerfTable {
  if (curves.length === 0) return { curves: [], zMin: 0, zMax: 0 };
  let zMin = Infinity,
    zMax = -Infinity;
  for (const c of curves) {
    if (c.z < zMin) zMin = c.z;
    if (c.z > zMax) zMax = c.z;
  }
  // VBA assumes file order; lookup bracketing walks ascending in Z.
  const sorted = [...curves].sort((a, b) => a.z - b.z);
  return { curves: sorted, zMin, zMax };
}

export function isCurveXIncreasing(c: TableCurve): boolean {
  return c.points[0].x < c.points[c.points.length - 1].x;
}
export function isCurveYIncreasing(c: TableCurve): boolean {
  return c.points[0].y < c.points[c.points.length - 1].y;
}

// ─── DECRYPTION ────────────────────────────────────────────────────────────

/**
 * Decode the proprietary hex format: (parseHex(token, 32-bit-signed) - 24328) / 1200.
 * VBA's CLng wraps values > 0x7FFFFFFF to negative; mirror that.
 */
export function decodeHexValue(token: string): number {
  const trimmed = token.trim();
  if (trimmed.length === 0) return NaN;
  // parseInt with radix 16 handles signed/unsigned identically; we adjust below.
  const unsigned = parseInt(trimmed, 16);
  if (!Number.isFinite(unsigned)) return NaN;
  const signed = unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;
  return (signed - 24328) / 1200.0;
}

// ─── LOADER ────────────────────────────────────────────────────────────────

const tableCache = new Map<string, Promise<PerfTable | null>>();

export function clearPerfTableCache(): void {
  tableCache.clear();
}

/**
 * Load and parse a .dat performance chart from the given URL. Each chart is
 * cached after the first load; concurrent calls share the same fetch.
 */
export function loadPerfTable(url: string): Promise<PerfTable | null> {
  let pending = tableCache.get(url);
  if (pending) return pending;
  pending = fetchAndParse(url);
  tableCache.set(url, pending);
  return pending;
}

async function fetchAndParse(url: string): Promise<PerfTable | null> {
  let content: string;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    content = await res.text();
  } catch {
    return null;
  }

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Each curve uses 2 lines: drop a trailing odd line if present.
  if (lines.length % 2 === 1) lines.pop();

  const curves: TableCurve[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const xParts = lines[i].split(';');
    const yParts = lines[i + 1].split(';');
    if (xParts.length === 0 || yParts.length === 0) continue;

    const z = decodeHexValue(xParts[0]);
    if (Number.isNaN(z)) continue;

    const n = Math.min(xParts.length, yParts.length);
    const points: TablePoint[] = [];
    for (let j = 1; j < n; j++) {
      const x = decodeHexValue(xParts[j]);
      const y = decodeHexValue(yParts[j]);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      points.push({ x, y });
    }
    if (points.length > 0) curves.push(makeCurve(z, points));
  }
  return makeTable(curves);
}

// ─── INTERPOLATION ─────────────────────────────────────────────────────────

export type OutOfRange = 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax';

export interface TableLookup {
  value: number | null;
  outOfRange: OutOfRange | null;
  curveIndexLow: number | null;
  curveIndexHigh: number | null;
  zLow: number | null;
  zHigh: number | null;
}

function ok(value: number, opts: Partial<TableLookup> = {}): TableLookup {
  return {
    value,
    outOfRange: null,
    curveIndexLow: opts.curveIndexLow ?? null,
    curveIndexHigh: opts.curveIndexHigh ?? null,
    zLow: opts.zLow ?? null,
    zHigh: opts.zHigh ?? null,
  };
}
function outside(
  r: OutOfRange,
  opts: Partial<TableLookup> = {},
): TableLookup {
  return {
    value: null,
    outOfRange: r,
    curveIndexLow: opts.curveIndexLow ?? null,
    curveIndexHigh: opts.curveIndexHigh ?? null,
    zLow: opts.zLow ?? null,
    zHigh: opts.zHigh ?? null,
  };
}

export function isLookupOk(l: TableLookup): boolean {
  return l.value !== null && l.outOfRange === null;
}

function yFromXOnCurve(curve: TableCurve, x: number): number | null {
  if (curve.points.length < 2) {
    if (curve.points.length > 0 && curve.points[0].x === x) {
      return curve.points[0].y;
    }
    return null;
  }
  const increasing = isCurveXIncreasing(curve);
  if (increasing) {
    if (x < curve.xMin || x > curve.xMax) return null;
  } else {
    if (x > curve.xMax || x < curve.xMin) return null;
  }
  for (let j = 0; j < curve.points.length - 1; j++) {
    const p1 = curve.points[j];
    const p2 = curve.points[j + 1];
    if (increasing) {
      if (p1.x === x) return p1.y;
      if (p1.x < x && x < p2.x) {
        return linearInterpolation(x, p1.x, p2.x, p1.y, p2.y);
      }
      if (j === curve.points.length - 2 && p2.x === x) return p2.y;
    } else {
      if (p1.x === x) return p1.y;
      if (p1.x > x && x > p2.x) {
        return linearInterpolation(x, p2.x, p1.x, p2.y, p1.y);
      }
      if (j === curve.points.length - 2 && p2.x === x) return p2.y;
    }
  }
  return null;
}

function xFromYOnCurve(curve: TableCurve, y: number): number | null {
  if (curve.points.length < 2) {
    if (curve.points.length > 0 && curve.points[0].y === y) {
      return curve.points[0].x;
    }
    return null;
  }
  const increasing = isCurveYIncreasing(curve);
  if (increasing) {
    if (y < curve.yMin || y > curve.yMax) return null;
  } else {
    if (y > curve.yMax || y < curve.yMin) return null;
  }
  for (let j = 0; j < curve.points.length - 1; j++) {
    const p1 = curve.points[j];
    const p2 = curve.points[j + 1];
    if (increasing) {
      if (p1.y === y) return p1.x;
      if (p1.y < y && y < p2.y) {
        return linearInterpolation(y, p1.y, p2.y, p1.x, p2.x);
      }
      if (j === curve.points.length - 2 && p2.y === y) return p2.x;
    } else {
      if (p1.y === y) return p1.x;
      if (p1.y > y && y > p2.y) {
        return linearInterpolation(y, p2.y, p1.y, p2.x, p1.x);
      }
      if (j === curve.points.length - 2 && p2.y === y) return p2.x;
    }
  }
  return null;
}

function yRangeCheck(curve: TableCurve, y: number): OutOfRange | null {
  if (y < curve.yMin) return 'yMin';
  if (y > curve.yMax) return 'yMax';
  return null;
}
function xRangeCheck(curve: TableCurve, x: number): OutOfRange | null {
  if (x < curve.xMin) return 'xMin';
  if (x > curve.xMax) return 'xMax';
  return null;
}

/** VBA: XfromYZ(Y, Z, table) — find X such that the table maps (X, Y, Z). */
export function xFromYZ(table: PerfTable, y: number, z: number): TableLookup {
  if (table.curves.length === 0) return outside('zMin');
  if (z < table.zMin) return outside('zMin');
  if (z > table.zMax) return outside('zMax');

  for (let i = 0; i < table.curves.length; i++) {
    const c = table.curves[i];
    if (c.z === z) {
      const yRange = yRangeCheck(c, y);
      if (yRange !== null) {
        return outside(yRange, { curveIndexLow: i, zLow: c.z });
      }
      const x = xFromYOnCurve(c, y);
      if (x === null) {
        return outside('yMax', { curveIndexLow: i, zLow: c.z });
      }
      return ok(x, { curveIndexLow: i, zLow: c.z });
    }
    if (c.z > z) {
      const lo = table.curves[i - 1];
      const hi = c;
      const meta = {
        curveIndexLow: i - 1,
        curveIndexHigh: i,
        zLow: lo.z,
        zHigh: hi.z,
      };

      const yLow = yRangeCheck(lo, y);
      if (yLow !== null) return outside(yLow, meta);
      const xLow = xFromYOnCurve(lo, y);
      if (xLow === null) return outside('yMax', meta);

      const yHigh = yRangeCheck(hi, y);
      if (yHigh !== null) return outside(yHigh, meta);
      const xHigh = xFromYOnCurve(hi, y);
      if (xHigh === null) return outside('yMax', meta);

      const result = linearInterpolation(z, lo.z, hi.z, xLow, xHigh);
      return ok(result, meta);
    }
  }
  return outside('zMax');
}

/** VBA: YfromXZ(X, Z, table) — mirror of xFromYZ swapping X/Y roles. */
export function yFromXZ(table: PerfTable, x: number, z: number): TableLookup {
  if (table.curves.length === 0) return outside('zMin');
  if (z < table.zMin) return outside('zMin');
  if (z > table.zMax) return outside('zMax');

  for (let i = 0; i < table.curves.length; i++) {
    const c = table.curves[i];
    if (c.z === z) {
      const xRange = xRangeCheck(c, x);
      if (xRange !== null) {
        return outside(xRange, { curveIndexLow: i, zLow: c.z });
      }
      const yVal = yFromXOnCurve(c, x);
      if (yVal === null) {
        return outside('xMax', { curveIndexLow: i, zLow: c.z });
      }
      return ok(yVal, { curveIndexLow: i, zLow: c.z });
    }
    if (c.z > z) {
      const lo = table.curves[i - 1];
      const hi = c;
      const meta = {
        curveIndexLow: i - 1,
        curveIndexHigh: i,
        zLow: lo.z,
        zHigh: hi.z,
      };

      const xLow = xRangeCheck(lo, x);
      if (xLow !== null) return outside(xLow, meta);
      const yLow = yFromXOnCurve(lo, x);
      if (yLow === null) return outside('xMax', meta);

      const xHigh = xRangeCheck(hi, x);
      if (xHigh !== null) return outside(xHigh, meta);
      const yHigh = yFromXOnCurve(hi, x);
      if (yHigh === null) return outside('xMax', meta);

      const result = linearInterpolation(z, lo.z, hi.z, yLow, yHigh);
      return ok(result, meta);
    }
  }
  return outside('zMax');
}
