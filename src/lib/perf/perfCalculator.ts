// Full NH90 performance calculator. Port of lib/performance/perf_calculator.dart.
//
// Faithful TypeScript port of the VBA macro module shipped with
// "Performances NH90.xls". Public methods correspond 1:1 to the VBA Public
// Functions (dragIndex, rocDeRating, hoverWeight, hoverAltitude,
// hoverAltitudeIsa, takeoffLandingWeight, weightIndex, rateOfClimb,
// criticalOeiFl, heightLoss, heightLossTraining).

import {
  isOutsideIsa,
  linearInterpolation,
  standardDecay,
} from './atmosphere';
import {
  FILE_ROC_DE_RATING,
  FILE_TAKEOFF_PERF_0,
  FILE_TAKEOFF_PERF_1,
  FILE_WEIGHT_INDEX_0,
  FILE_WEIGHT_INDEX_1,
  heightLossFilename,
  heightLossTrainingFilename,
  hoverFilename,
  rocFilename,
  tokensForHover,
  tokensForRoc,
  type AssetResolver,
  type FileTokens,
} from './assetResolver';
import type { EngineRating, HoverMode, PerfConfig } from './perfConfig';
import {
  isUsable,
  perfCeiling,
  perfMtowClamped,
  perfNoData,
  perfOutsideChart,
  perfOutsideIsa,
  perfValue,
  type PerfResult,
} from './perfResult';
import { loadPerfTable, xFromYZ, yFromXZ } from './perfTable';

/** Detailed Height-Loss result with stage-1 and stage-2 intermediates. */
export interface HeightLossDetail {
  result: PerfResult;
  /** Stage-1 transfer (HL_0). null when stage 1 didn't yield a value. */
  hl0: number | null;
  /** Stage-2 transfer (HL_1). null when stage 2 didn't yield a value. */
  hl1: number | null;
  pa: number;
  oat: number;
  wi: number;
  wind: number;
}

export interface RateOfClimbWithTransfer {
  roc: PerfResult;
  transfer: number | null;
}

export class PerfCalculator {
  readonly resolver: AssetResolver;
  /** MTOW cap applied to every weight result (kg). VBA clamps at 11000. */
  readonly mtowKg: number;
  readonly hoistDrag: number;
  readonly hscDrag: number;
  readonly doorDrag: number;

  constructor(opts: {
    resolver: AssetResolver;
    mtowKg?: number;
    hoistDrag?: number;
    hscDrag?: number;
    doorDrag?: number;
  }) {
    this.resolver = opts.resolver;
    this.mtowKg = opts.mtowKg ?? 11000;
    this.hoistDrag = opts.hoistDrag ?? 3;
    this.hscDrag = opts.hscDrag ?? 4;
    this.doorDrag = opts.doorDrag ?? 2.5;
  }

  // ─── 1. Drag Index ───────────────────────────────────────────────────────

  /** VBA: Drag_Index(). Sum of drag contributions from external equipment. */
  dragIndex(cfg: PerfConfig): number {
    let di = 0;
    if (cfg.hoist) di += this.hoistDrag;
    if (cfg.hsc) di += this.hscDrag;
    if (cfg.lhDoor) di += this.doorDrag;
    if (cfg.rhDoor) di += this.doorDrag;
    return di;
  }

  // ─── 2. ROC De-Rating ────────────────────────────────────────────────────

  /** VBA: ROC_De_Rating(OAT, WI). Returns 0 when no drag is present. */
  async rocDeRating(
    cfg: PerfConfig,
    oat: number,
    weightIndex: number,
  ): Promise<PerfResult> {
    const di = this.dragIndex(cfg);
    if (di === 0) return perfValue(0);

    const url = this.resolver.resolve(FILE_ROC_DE_RATING);
    if (url === null) return perfNoData;
    const table = await loadPerfTable(url);
    if (table === null || table.curves.length === 0) return perfNoData;

    const lookup = yFromXZ(table, weightIndex, di);
    if (lookup.value === null) {
      // VBA collapses Z_MIN, Z_MAX, X_MAX → "HORS COURBE"
      return perfOutsideChart;
    }
    return perfValue(lookup.value);
  }

  // ─── 3. Hover Weight ─────────────────────────────────────────────────────

  /** VBA: Hover_Weight(PA, OAT, OGE_IGE, Engine_Rating). Max mass at PA/OAT. */
  async hoverWeight(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    mode: HoverMode,
    rating: EngineRating,
  ): Promise<PerfResult> {
    if (isOutsideIsa(pa, oat)) return perfOutsideIsa;

    const tokens = tokensForHover(cfg, oat, rating);
    const url = this.resolver.resolve(hoverFilename(mode, rating, tokens));
    if (url === null) return perfNoData;
    const table = await loadPerfTable(url);
    if (table === null || table.curves.length === 0) return perfNoData;

    // VBA: XfromYZ(PA, OAT, ...). Z=temperature, X=weight, Y=PA.
    const lookup = xFromYZ(table, pa, oat);
    if (
      lookup.outOfRange === 'zMin' ||
      lookup.outOfRange === 'zMax' ||
      lookup.outOfRange === 'yMax'
    ) {
      return perfOutsideChart;
    }
    const raw = lookup.value;
    if (raw === null) {
      // Y_MIN / X_MIN / X_MAX path — VBA clamps to MTOW for hover
      return perfMtowClamped;
    }
    if (raw > this.mtowKg) return perfMtowClamped;
    return perfValue(raw);
  }

  // ─── 4. Hover Altitude ───────────────────────────────────────────────────

  /** VBA: Hover_Altitude(Weight, OAT, OGE_IGE, Engine_Rating). Max PA at weight/OAT. */
  async hoverAltitude(
    cfg: PerfConfig,
    weight: number,
    oat: number,
    mode: HoverMode,
    rating: EngineRating,
  ): Promise<PerfResult> {
    const tokens = tokensForHover(cfg, oat, rating);
    const url = this.resolver.resolve(hoverFilename(mode, rating, tokens));
    if (url === null) return perfNoData;
    const table = await loadPerfTable(url);
    if (table === null || table.curves.length === 0) return perfNoData;

    const lookup = yFromXZ(table, weight, oat);
    if (
      lookup.outOfRange === 'zMin' ||
      lookup.outOfRange === 'zMax' ||
      lookup.outOfRange === 'xMax'
    ) {
      return perfOutsideChart;
    }
    const raw = lookup.value;
    if (raw === null || raw > 20000) return perfValue(20000);
    return perfValue(raw);
  }

  // ─── 5. Hover Altitude ISA ───────────────────────────────────────────────

  /**
   * VBA: Hover_Altitude_ISA(Weight, OAT, PA, OGE_IGE, Engine_Rating).
   * Bisection: highest PA where the helicopter can still hover at the given
   * weight, applying the standard -2°C/1000 ft decay between reference and
   * candidate altitudes.
   */
  async hoverAltitudeIsa(
    cfg: PerfConfig,
    weight: number,
    oat: number,
    refPa: number,
    mode: HoverMode,
    rating: EngineRating,
  ): Promise<PerfResult> {
    if (isOutsideIsa(refPa, oat)) return perfOutsideIsa;

    const tokens = tokensForHover(cfg, oat, rating);
    const url = this.resolver.resolve(hoverFilename(mode, rating, tokens));
    if (url === null) return perfNoData;
    const table = await loadPerfTable(url);
    if (table === null || table.curves.length === 0) return perfNoData;

    const refOat = oat;

    // First iteration: max weight at the reference (PA, OAT)
    const initialLookup = xFromYZ(table, refPa, refOat);
    let calcWeight: number;
    if (
      initialLookup.outOfRange === 'zMin' ||
      initialLookup.outOfRange === 'zMax' ||
      initialLookup.outOfRange === 'yMax'
    ) {
      return perfCeiling;
    }
    const initialRaw = initialLookup.value;
    if (initialRaw === null || initialRaw > this.mtowKg) {
      calcWeight = this.mtowKg;
    } else {
      calcWeight = initialRaw;
    }

    const wRound = Math.round(weight);

    let paMin: number;
    let paMax: number;
    if (initialLookup.curveIndexHigh !== null) {
      const loIdx = initialLookup.curveIndexLow!;
      const hiIdx = initialLookup.curveIndexHigh;
      const oatLow = initialLookup.zLow!;
      const oatHigh = initialLookup.zHigh!;
      const paMinLow = table.curves[loIdx].yMin;
      const paMinHigh = table.curves[hiIdx].yMin;
      const paMaxLow = table.curves[loIdx].yMax;
      const paMaxHigh = table.curves[hiIdx].yMax;

      if (wRound > Math.round(calcWeight)) {
        paMin = linearInterpolation(
          refOat,
          oatLow,
          oatHigh,
          paMinLow,
          paMinHigh,
        );
        paMax = refPa;
      } else if (wRound < Math.round(calcWeight)) {
        paMin = refPa;
        paMax = linearInterpolation(
          refOat,
          oatLow,
          oatHigh,
          paMaxLow,
          paMaxHigh,
        );
      } else {
        return perfValue(refPa);
      }
    } else {
      const idx = initialLookup.curveIndexLow!;
      const paMinValue = table.curves[idx].yMin;
      const paMaxValue = table.curves[idx].yMax;
      if (wRound > Math.round(calcWeight)) {
        paMin = paMinValue;
        paMax = refPa;
      } else if (wRound < Math.round(calcWeight)) {
        paMin = refPa;
        paMax = paMaxValue;
      } else {
        return perfValue(refPa);
      }
    }

    let paMid = (paMin + paMax) / 2;
    let oatNow = oat;
    let antiLoop = 0;
    while (Math.round(calcWeight) !== wRound) {
      paMid = (paMax + paMin) / 2;
      oatNow = standardDecay(refPa, paMid, refOat);

      // Clamp OAT to operational envelope (-40°C ↔ 50°C)
      if (oatNow > 50) {
        paMid = paMid + Math.abs(50 - oatNow) * 500;
        oatNow = 50;
      } else if (oatNow < -40) {
        paMid = paMid - Math.abs(-40 - oatNow) * 500;
        oatNow = -40;
      }

      const lookup = xFromYZ(table, paMid, oatNow);
      let cw: number;
      if (lookup.value === null || lookup.value > this.mtowKg) {
        cw = this.mtowKg;
      } else {
        cw = lookup.value;
      }
      calcWeight = cw;

      if (calcWeight > wRound && oatNow > -40) {
        paMin = paMid;
      } else if (calcWeight < wRound && oatNow < 50) {
        paMax = paMid;
      } else if (calcWeight < wRound && oatNow === 50) {
        return perfCeiling;
      } else if (calcWeight > wRound && oatNow === -40) {
        return perfValue(paMid);
      }

      if (++antiLoop > 1000) return perfCeiling;
    }
    return perfValue(paMid);
  }

  // ─── 6. Takeoff/Landing Weight ───────────────────────────────────────────

  /**
   * VBA: Takeoff_Landing_Weight(PA, OAT).
   * Two-stage: PA + OAT → density altitude → max weight.
   */
  async takeoffLandingWeight(pa: number, oat: number): Promise<PerfResult> {
    if (isOutsideIsa(pa, oat)) return perfOutsideIsa;

    const path0 = this.resolver.resolve(FILE_TAKEOFF_PERF_0);
    if (path0 === null) return perfNoData;
    const t0 = await loadPerfTable(path0);
    if (t0 === null || t0.curves.length === 0) return perfNoData;

    const stage1 = yFromXZ(t0, oat, pa);
    if (stage1.value === null) return perfOutsideChart;
    const densityAltitude = stage1.value;

    const path1 = this.resolver.resolve(FILE_TAKEOFF_PERF_1);
    if (path1 === null) return perfNoData;
    const t1 = await loadPerfTable(path1);
    if (t1 === null || t1.curves.length === 0) return perfNoData;

    const stage2 = xFromYZ(t1, densityAltitude, 0);
    if (
      stage2.outOfRange === 'zMin' ||
      stage2.outOfRange === 'zMax' ||
      stage2.outOfRange === 'yMax'
    ) {
      return perfOutsideChart;
    }
    const raw = stage2.value;
    if (raw === null || raw > this.mtowKg) return perfMtowClamped;
    return perfValue(raw);
  }

  // ─── 7. Weight Index ─────────────────────────────────────────────────────

  /**
   * VBA: Weight_index(PA, OAT, Weight). Two-stage chained lookup.
   *  Stage 1: PA/1000 + OAT → WI_0  (YfromXZ on WEIGHT INDEX 0)
   *  Stage 2: Weight + WI_0 → WI    (XfromYZ on WEIGHT INDEX 1)
   *  Result = WI / 1000
   */
  async weightIndex(
    pa: number,
    oat: number,
    weight: number,
  ): Promise<PerfResult> {
    if (isOutsideIsa(pa, oat)) return perfOutsideIsa;

    const path0 = this.resolver.resolve(FILE_WEIGHT_INDEX_0);
    if (path0 === null) return perfNoData;
    const t0 = await loadPerfTable(path0);
    if (t0 === null || t0.curves.length === 0) return perfNoData;

    const stage1 = yFromXZ(t0, oat, pa / 1000);
    if (
      stage1.outOfRange === 'zMin' ||
      stage1.outOfRange === 'zMax' ||
      stage1.outOfRange === 'xMax'
    ) {
      return perfCeiling;
    }
    const wi0 = stage1.value;
    if (wi0 === null) return perfCeiling;

    const path1 = this.resolver.resolve(FILE_WEIGHT_INDEX_1);
    if (path1 === null) return perfNoData;
    const t1 = await loadPerfTable(path1);
    if (t1 === null || t1.curves.length === 0) return perfNoData;

    const stage2 = xFromYZ(t1, wi0, weight);
    if (
      stage2.outOfRange === 'zMin' ||
      stage2.outOfRange === 'zMax' ||
      stage2.outOfRange === 'yMax'
    ) {
      return perfCeiling;
    }
    const raw = stage2.value;
    if (raw === null) return perfCeiling;
    return perfValue(raw / 1000);
  }

  // ─── 8. Rate of Climb ────────────────────────────────────────────────────

  /**
   * Bundle of ROC + the intermediate "transfer" value used by the UI to draw
   * graph crosshairs. Two-stage chained lookup.
   */
  async rateOfClimbWithTransfer(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    tas: number,
    weightIndex: number,
    rating: EngineRating,
  ): Promise<RateOfClimbWithTransfer> {
    if (isOutsideIsa(pa, oat)) {
      return { roc: perfOutsideIsa, transfer: null };
    }

    const tokens = tokensForRoc(cfg, oat, rating);

    const path0 = this.resolver.resolve(rocFilename(rating, tas, tokens, 0));
    if (path0 === null) return { roc: perfNoData, transfer: null };
    const t0 = await loadPerfTable(path0);
    if (t0 === null || t0.curves.length === 0) {
      return { roc: perfNoData, transfer: null };
    }

    const stage1 = yFromXZ(t0, oat, pa / 1000);
    if (
      stage1.outOfRange === 'zMin' ||
      stage1.outOfRange === 'zMax' ||
      stage1.outOfRange === 'xMax'
    ) {
      return { roc: perfCeiling, transfer: null };
    }
    const transfer = stage1.value;
    if (transfer === null) return { roc: perfCeiling, transfer: null };

    const path1 = this.resolver.resolve(rocFilename(rating, tas, tokens, 1));
    if (path1 === null) return { roc: perfNoData, transfer };
    const t1 = await loadPerfTable(path1);
    if (t1 === null || t1.curves.length === 0) {
      return { roc: perfNoData, transfer };
    }

    const stage2 = xFromYZ(t1, transfer, weightIndex);
    if (
      stage2.outOfRange === 'zMin' ||
      stage2.outOfRange === 'zMax' ||
      stage2.outOfRange === 'yMax'
    ) {
      return { roc: perfOutsideChart, transfer };
    }
    const roc = stage2.value;
    if (roc === null) return { roc: perfOutsideChart, transfer };
    return { roc: perfValue(roc), transfer };
  }

  /** VBA: Rate_Of_Climb(PA, OAT, TAS, WI, Engine_Rating). */
  async rateOfClimb(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    tas: number,
    weightIndex: number,
    rating: EngineRating,
  ): Promise<PerfResult> {
    const res = await this.rateOfClimbWithTransfer(
      cfg,
      pa,
      oat,
      tas,
      weightIndex,
      rating,
    );
    return res.roc;
  }

  // ─── 9. Critical OEI Flight Level ────────────────────────────────────────

  /**
   * VBA: Critical_OEI_FL(PA, OAT, Weight).
   * Bisects altitude until OEI MCP ROC at 80kt equals 50 ft/min.
   * Result is in flight-level units (PA / 100).
   */
  async criticalOeiFl(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weight: number,
  ): Promise<PerfResult> {
    const refPa = pa;
    const refOat = oat;

    if (isOutsideIsa(refPa, refOat)) return perfOutsideIsa;

    const evalAt = async (
      curPa: number,
      curOat: number,
    ): Promise<{
      roc: PerfResult;
      transfer: number | null;
      wi: PerfResult;
    }> => {
      const wi = await this.weightIndex(curPa, curOat, weight);
      if (!isUsable(wi)) {
        return { roc: perfOutsideChart, transfer: null, wi };
      }
      const res = await this.rateOfClimbWithTransfer(
        cfg,
        curPa,
        curOat,
        80,
        wi.value,
        'oeiMcp',
      );
      return { roc: res.roc, transfer: res.transfer, wi };
    };

    const initial = await evalAt(refPa, refOat);
    if (initial.roc.status !== 'ok') return initial.roc;
    let currentRoc = initial.roc.value;

    const tokens = tokensForRoc(cfg, refOat, 'oeiMcp');
    const path0 = this.resolver.resolve(rocFilename('oeiMcp', 80, tokens, 0));
    const t0 = path0 === null ? null : await loadPerfTable(path0);
    const paHigh = (t0?.zMax ?? 20) * 1000;
    const paLow = (t0?.zMin ?? -2) * 1000;

    let paMin: number;
    let paMax: number;
    if (Math.round(currentRoc) > 50) {
      paMin = refPa;
      paMax = paHigh;
    } else if (Math.round(currentRoc) < 50) {
      paMin = paLow;
      paMax = refPa;
    } else {
      return perfValue(refPa / 100);
    }

    let antiLoop = 0;
    let curOat = refOat;
    let paMid = refPa;
    while (Math.round(currentRoc) !== 50) {
      paMid = (paMax + paMin) / 2;
      curOat = standardDecay(refPa, paMid, refOat);
      if (curOat > 50) {
        paMid = paMid + Math.abs(50 - curOat) * 500;
        curOat = 50;
      } else if (curOat < -40) {
        paMid = paMid - Math.abs(-40 - curOat) * 500;
        curOat = -40;
      }

      const res = await evalAt(paMid, curOat);
      if (res.roc.status !== 'ok') return res.roc;
      currentRoc = res.roc.value;

      if (Math.round(currentRoc) > 50 && curOat > -40) {
        paMin = paMid;
      } else if (Math.round(currentRoc) < 50 && curOat < 50) {
        paMax = paMid;
      } else if (Math.round(currentRoc) < 50 && curOat === 50) {
        return perfCeiling;
      } else if (Math.round(currentRoc) > 50 && curOat === -40) {
        return perfValue(paMid / 100);
      }

      if (++antiLoop > 1000) return perfCeiling;
    }
    return perfValue(paMid / 100);
  }

  // ─── 10. Height Loss ─────────────────────────────────────────────────────

  /** VBA: Height_Loss(PA, OAT, WI, Wind). */
  async heightLoss(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weightIndexValue: number,
    wind: number,
  ): Promise<PerfResult> {
    const detail = await this.heightLossDetail(
      cfg,
      pa,
      oat,
      weightIndexValue,
      wind,
    );
    return detail.result;
  }

  /** VBA: Height_Loss_Training(PA, OAT, WI, Wind). */
  async heightLossTraining(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weightIndexValue: number,
    wind: number,
  ): Promise<PerfResult> {
    const detail = await this.heightLossTrainingDetail(
      cfg,
      pa,
      oat,
      weightIndexValue,
      wind,
    );
    return detail.result;
  }

  heightLossDetail(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weightIndexValue: number,
    wind: number,
  ): Promise<HeightLossDetail> {
    return this.heightLossInner(
      cfg,
      pa,
      oat,
      weightIndexValue,
      wind,
      heightLossFilename,
    );
  }

  heightLossTrainingDetail(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weightIndexValue: number,
    wind: number,
  ): Promise<HeightLossDetail> {
    return this.heightLossInner(
      cfg,
      pa,
      oat,
      weightIndexValue,
      wind,
      heightLossTrainingFilename,
    );
  }

  private async heightLossInner(
    cfg: PerfConfig,
    pa: number,
    oat: number,
    weightIndexValue: number,
    wind: number,
    filenameBuilder: (t: FileTokens, part: number) => string,
  ): Promise<HeightLossDetail> {
    const bail = (
      r: PerfResult,
      opts: { hl0?: number | null; hl1?: number | null } = {},
    ): HeightLossDetail => ({
      result: r,
      hl0: opts.hl0 ?? null,
      hl1: opts.hl1 ?? null,
      pa,
      oat,
      wi: weightIndexValue,
      wind,
    });

    if (isOutsideIsa(pa, oat)) return bail(perfOutsideIsa);

    // Detect training mode from the filename builder.
    const isTraining = filenameBuilder(
      { asfIps: '', asfIpsFolder: '', ecsStatus: '', engineAntiIcing: '' },
      0,
    )
      .toUpperCase()
      .includes('TRAINING');
    const tokens = tokensForRoc(
      cfg,
      oat,
      isTraining ? 'trainingOeiLow' : undefined,
    );

    // Stage 1
    const p0 = this.resolver.resolve(filenameBuilder(tokens, 0));
    if (p0 === null) return bail(perfNoData);
    const t0 = await loadPerfTable(p0);
    if (t0 === null || t0.curves.length === 0) return bail(perfNoData);
    const s1 = yFromXZ(t0, oat, pa / 1000);
    if (
      s1.outOfRange === 'zMin' ||
      s1.outOfRange === 'zMax' ||
      s1.outOfRange === 'xMax'
    ) {
      return bail(perfCeiling);
    }
    const hl0 = s1.value;
    if (hl0 === null) return bail(perfCeiling);

    // Stage 2 — note WI is multiplied by 10 (VBA fidelity)
    const p1 = this.resolver.resolve(filenameBuilder(tokens, 1));
    if (p1 === null) return bail(perfNoData, { hl0 });
    const t1 = await loadPerfTable(p1);
    if (t1 === null || t1.curves.length === 0) return bail(perfNoData, { hl0 });
    const s2 = xFromYZ(t1, hl0, weightIndexValue * 10);
    let hl1: number;
    if (s2.outOfRange === 'zMax') {
      return bail(perfCeiling, { hl0 });
    } else if (s2.outOfRange === 'yMax' || s2.outOfRange === 'zMin') {
      // VBA reuses the X_min of the first curve
      hl1 = t1.curves[0].xMin;
    } else if (s2.value !== null) {
      hl1 = s2.value;
    } else {
      return bail(perfOutsideChart, { hl0 });
    }

    // Stage 3
    const p2 = this.resolver.resolve(filenameBuilder(tokens, 2));
    if (p2 === null) return bail(perfNoData, { hl0, hl1 });
    const t2 = await loadPerfTable(p2);
    if (t2 === null || t2.curves.length === 0)
      return bail(perfNoData, { hl0, hl1 });
    const s3 = yFromXZ(t2, hl1, wind);
    if (
      s3.outOfRange === 'zMin' ||
      s3.outOfRange === 'zMax' ||
      s3.outOfRange === 'xMax'
    ) {
      return bail(perfCeiling, { hl0, hl1 });
    }
    if (s3.value === null) return bail(perfOutsideChart, { hl0, hl1 });
    return bail(perfValue(s3.value), { hl0, hl1 });
  }
}
