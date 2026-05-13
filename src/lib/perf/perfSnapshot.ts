// Performance snapshot orchestrator. Port of lib/performance/perf_snapshot.dart.
//
// Builds a complete [PerfSnapshot] by calling the underlying calculator for
// every cell the spreadsheet shows: hover IGE/OGE × AEO/OEI, 9 ROC variants,
// critical OEI FL, height-loss × 2, MTOW, drag, decision matrix.

import { isOutsideIsa, pressureAltitudeFromQnh } from './atmosphere';
import type { EngineRating, HoverMode, PerfConfig } from './perfConfig';
import {
  isOk as isResultOk,
  isUsable as isResultUsable,
  perfOutsideChart,
  perfOutsideIsa,
  perfValue,
  type PerfResult,
} from './perfResult';
import type { HeightLossDetail, PerfCalculator } from './perfCalculator';

export interface PerfInputs {
  qnh: number;
  oat: number;
  indicatedAltitude: number;
  wind: number;
  gw: number;
  config: PerfConfig;
}

export function paFromInputs(i: PerfInputs): number {
  return pressureAltitudeFromQnh(i.indicatedAltitude, i.qnh);
}

export interface HoverCell {
  /** Max altitude with current weight. */
  maxAltitudeIsa: PerfResult;
  /** Max weight at current PA/OAT. */
  maxWeight: PerfResult;
  /** Minutes of fuel burn to clear overweight; null when no overweight margin. */
  minutesToClear: number | null;
}

export interface RocCell {
  roc: PerfResult;
  /** ROC / 100 / TAS — approximation of climb gradient in %. */
  gradientPct: number | null;
  /** Stage-1 transfer used by the graph crosshair painter. */
  transferValue: number | null;
  /** OAT actually used in the lookup (with OEI offset applied). */
  effectiveOat: number;
  /** PA actually used in the lookup (with OEI offset applied). */
  effectivePa: number;
  /** WI actually used (recomputed at offset altitude for OEI). null when WI is unusable. */
  effectiveWi: number | null;
}

export type AircraftCategory =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'veryHeavy'
  | 'unknown';

export const AIRCRAFT_CATEGORY_LABEL: Record<AircraftCategory, string> = {
  light: 'LIGHT',
  medium: 'MEDIUM',
  heavy: 'HEAVY',
  veryHeavy: 'VERY HEAVY',
  unknown: 'UNKNOWN',
};

export const AIRCRAFT_CATEGORY_DESCRIPTION: Record<AircraftCategory, string> = {
  light: 'Vtoss = 45Kts. Segments 1+2',
  medium: '45Kts < Vtoss < Vy, Segment 2',
  heavy: 'Vy. FlyAway not possible. 2\'30" Flight',
  veryHeavy: 'Vy. FlyAway not possible. 30" Flight',
  unknown: '',
};

export interface DecisionMatrix {
  /** Criterion 1: OEI Low 45kt ROC ≥ 100 ft/min @ 200 ft. */
  c1Oei: boolean | null;
  c1Training: boolean | null;
  /** Criterion 2: OEI Cont (MCP) Vy ROC ≥ 150 ft/min @ 1000 ft. */
  c2Oei: boolean | null;
  c2Training: boolean | null;
  /** Criterion 3: OEI Cont Vy ROC ≥ 0 ft/min AT 1000 ft. */
  c3Oei: boolean | null;
  c3Training: boolean | null;
  /** Criterion 4: OEI Low Vy ROC ≥ 0 ft/min AT 1000 ft. */
  c4Oei: boolean | null;
  c4Training: boolean | null;
  /** Criterion 5: OEI Low 45kt ROC ≥ 400 ft/min @ 200 ft (confined area). */
  c5Oei: boolean | null;
  c5Training: boolean | null;
  category: AircraftCategory;
  confinedAreaOei: boolean;
  confinedAreaTraining: boolean;
  confinedAreaNotGuaranteedOei: boolean;
  confinedAreaNotGuaranteedTraining: boolean;
}

export interface PerfSnapshot {
  pressureAltitude: number;
  deltaIsaCheck: PerfResult;
  weightIndex: PerfResult;
  dragIndex: number;
  rocDeRating: PerfResult;
  mtow: PerfResult;
  takeoffLandingWeight: PerfResult;
  hoverIgeAeo: HoverCell;
  hoverIgeOei: HoverCell;
  hoverOgeAeo: HoverCell;
  hoverOgeOei: HoverCell;
  rocAeoMtopVy: RocCell;
  rocAeoMtop45: RocCell;
  rocAeoMcp80: RocCell;
  rocOeiLow80: RocCell;
  rocOeiLow45: RocCell;
  rocOeiMcp80: RocCell;
  rocTrainingOeiLow80: RocCell;
  rocTrainingOeiLow45: RocCell;
  rocTrainingOeiMcp80: RocCell;
  criticalOeiFl: PerfResult;
  heightLoss: PerfResult;
  heightLossTraining: PerfResult;
  heightLossDetail: HeightLossDetail;
  heightLossTrainingDetail: HeightLossDetail;
  /** Best Range Vi placeholder (VBA implementation buggy in source workbook). */
  bestRangeVi: PerfResult;
  decisionMatrix: DecisionMatrix;
}

/** VBA: OEI Vy is evaluated at PA+1000, OAT-2 (safety margin altitudes). */
export const OEI_VY_PA_OFFSET = 1000;
export const OEI_VY_OAT_OFFSET = -2;
export const OEI_45_PA_OFFSET = 200;
export const OEI_45_OAT_OFFSET = -0.4;

export class PerfSnapshotEngine {
  constructor(private readonly calc: PerfCalculator) {}

  async compute(inputs: PerfInputs): Promise<PerfSnapshot> {
    const pa = paFromInputs(inputs);
    const { oat, wind, gw, config: cfg } = inputs;

    const isaCheck = isOutsideIsa(pa, oat) ? perfOutsideIsa : perfValue(0);

    const di = this.calc.dragIndex(cfg);
    const wi = await this.calc.weightIndex(pa, oat, gw);
    const wiVal = isResultOk(wi) ? wi.value : 0;
    const deRating = await this.calc.rocDeRating(cfg, oat, wiVal);

    // ── Hover cells ──────────────────────────────────────────────────────
    const hover = async (
      mode: HoverMode,
      rating: EngineRating,
    ): Promise<HoverCell> => {
      const maxAlt = await this.calc.hoverAltitude(cfg, gw, oat, mode, rating);
      const maxW = await this.calc.hoverWeight(cfg, pa, oat, mode, rating);
      let minutes: number | null = null;
      if (isResultUsable(maxW)) {
        const delta = gw - maxW.value;
        minutes = delta < 0 ? null : (delta / 600) * 60;
      }
      return {
        maxAltitudeIsa: maxAlt,
        maxWeight: maxW,
        minutesToClear: minutes,
      };
    };

    const igeAeo = await hover('ige', 'aeoMtop');
    const igeOei = await hover('ige', 'oeiLow');
    const ogeAeo = await hover('oge', 'aeoMtop');
    const ogeOei = await hover('oge', 'oeiLow');

    // MTOW = MIN(IGE AEO max weight, takeoff/landing max weight)
    const tlWeight = await this.calc.takeoffLandingWeight(pa, oat);
    let mtow: PerfResult;
    if (isResultUsable(igeAeo.maxWeight) && isResultUsable(tlWeight)) {
      const v =
        igeAeo.maxWeight.value < tlWeight.value
          ? igeAeo.maxWeight.value
          : tlWeight.value;
      mtow = perfValue(v);
    } else if (isResultUsable(igeAeo.maxWeight)) {
      mtow = igeAeo.maxWeight;
    } else if (isResultUsable(tlWeight)) {
      mtow = tlWeight;
    } else {
      mtow = igeAeo.maxWeight; // propagate the most informative error
    }

    // ── ROC cells ────────────────────────────────────────────────────────
    const roc = async (
      rating: EngineRating,
      tas: number,
      paIn: number,
      oatIn: number,
      customWi?: PerfResult,
    ): Promise<RocCell> => {
      const wiUsed = customWi ?? wi;
      if (!isResultUsable(wiUsed)) {
        return {
          roc: perfOutsideChart,
          gradientPct: null,
          transferValue: null,
          effectiveOat: oatIn,
          effectivePa: paIn,
          effectiveWi: null,
        };
      }
      const res = await this.calc.rateOfClimbWithTransfer(
        cfg,
        paIn,
        oatIn,
        tas,
        wiUsed.value,
        rating,
      );
      const grad = isResultOk(res.roc) ? res.roc.value / 100 / tas : null;
      return {
        roc: res.roc,
        gradientPct: grad,
        transferValue: res.transfer,
        effectiveOat: oatIn,
        effectivePa: paIn,
        effectiveWi: wiUsed.value,
      };
    };

    // OEI uses offset PA/OAT and a recomputed WI at the offset
    const wiOeiVy = await this.calc.weightIndex(
      pa + OEI_VY_PA_OFFSET,
      oat + OEI_VY_OAT_OFFSET,
      gw,
    );
    const wiOei45 = await this.calc.weightIndex(
      pa + OEI_45_PA_OFFSET,
      oat + OEI_45_OAT_OFFSET,
      gw,
    );

    const aeoMtopVy = await roc('aeoMtop', 75, pa, oat);
    const aeoMtop45 = await roc('aeoMtop', 45, pa, oat);
    const aeoMcp80 = await roc('aeoMcp', 80, pa, oat);

    const oeiLow80 = await roc(
      'oeiLow',
      80,
      pa + OEI_VY_PA_OFFSET,
      oat + OEI_VY_OAT_OFFSET,
      wiOeiVy,
    );
    const oeiLow45 = await roc(
      'oeiLow',
      45,
      pa + OEI_45_PA_OFFSET,
      oat + OEI_45_OAT_OFFSET,
      wiOei45,
    );
    const oeiMcp80 = await roc(
      'oeiMcp',
      80,
      pa + OEI_VY_PA_OFFSET,
      oat + OEI_VY_OAT_OFFSET,
      wiOeiVy,
    );

    const trnLow80 = await roc(
      'trainingOeiLow',
      80,
      pa + OEI_VY_PA_OFFSET,
      oat + OEI_VY_OAT_OFFSET,
      wiOeiVy,
    );
    const trnLow45 = await roc(
      'trainingOeiLow',
      45,
      pa + OEI_45_PA_OFFSET,
      oat + OEI_45_OAT_OFFSET,
      wiOei45,
    );
    const trnMcp80 = await roc(
      'trainingOeiMcp',
      80,
      pa + OEI_VY_PA_OFFSET,
      oat + OEI_VY_OAT_OFFSET,
      wiOeiVy,
    );

    const critOei = await this.calc.criticalOeiFl(cfg, pa, oat, gw);
    const hlD = await this.calc.heightLossDetail(cfg, pa, oat, wiVal, wind);
    const hlTD = await this.calc.heightLossTrainingDetail(
      cfg,
      pa,
      oat,
      wiVal,
      wind,
    );

    const matrix = buildDecisionMatrix({
      oeiLow45,
      oeiMcp80,
      oeiLow80,
      trnLow45,
      trnMcp80,
      trnLow80,
    });

    return {
      pressureAltitude: pa,
      deltaIsaCheck: isaCheck,
      weightIndex: wi,
      dragIndex: di,
      rocDeRating: deRating,
      mtow,
      takeoffLandingWeight: tlWeight,
      hoverIgeAeo: igeAeo,
      hoverIgeOei: igeOei,
      hoverOgeAeo: ogeAeo,
      hoverOgeOei: ogeOei,
      rocAeoMtopVy: aeoMtopVy,
      rocAeoMtop45: aeoMtop45,
      rocAeoMcp80: aeoMcp80,
      rocOeiLow80: oeiLow80,
      rocOeiLow45: oeiLow45,
      rocOeiMcp80: oeiMcp80,
      rocTrainingOeiLow80: trnLow80,
      rocTrainingOeiLow45: trnLow45,
      rocTrainingOeiMcp80: trnMcp80,
      criticalOeiFl: critOei,
      heightLoss: hlD.result,
      heightLossTraining: hlTD.result,
      heightLossDetail: hlD,
      heightLossTrainingDetail: hlTD,
      bestRangeVi: perfValue(120), // TODO: VBA implementation buggy
      decisionMatrix: matrix,
    };
  }
}

export function buildDecisionMatrix(args: {
  oeiLow45: RocCell;
  oeiMcp80: RocCell;
  oeiLow80: RocCell;
  trnLow45: RocCell;
  trnMcp80: RocCell;
  trnLow80: RocCell;
}): DecisionMatrix {
  const { oeiLow45, oeiMcp80, oeiLow80, trnLow45, trnMcp80, trnLow80 } = args;

  const gte = (r: PerfResult, threshold: number): boolean | null =>
    isResultUsable(r) ? r.value >= threshold : null;

  const c1o = gte(oeiLow45.roc, 100);
  const c1t = gte(trnLow45.roc, 100);
  const c2o = gte(oeiMcp80.roc, 150);
  const c2t = gte(trnMcp80.roc, 150);
  const c3o = gte(oeiMcp80.roc, 0);
  const c3t = gte(trnMcp80.roc, 0);
  const c4o = gte(oeiLow80.roc, 0);
  const c4t = gte(trnLow80.roc, 0);
  const c5o = gte(oeiLow45.roc, 400);
  const c5t = gte(trnLow45.roc, 400);

  let category: AircraftCategory;
  if (c1o === true && c2o === true) {
    category = 'light';
  } else if (c3o === true) {
    category = 'medium';
  } else if (c4o === true) {
    category = 'heavy';
  } else if (c1o === null && c2o === null && c3o === null && c4o === null) {
    category = 'unknown';
  } else {
    category = 'veryHeavy';
  }

  const confinedOk = c2o === true && c5o === true;
  const confinedOkT = c2t === true && c5t === true;
  const confinedNg =
    !confinedOk && isResultUsable(oeiLow45.roc) && isResultUsable(oeiMcp80.roc);
  const confinedNgT =
    !confinedOkT &&
    isResultUsable(trnLow45.roc) &&
    isResultUsable(trnMcp80.roc);

  return {
    c1Oei: c1o,
    c1Training: c1t,
    c2Oei: c2o,
    c2Training: c2t,
    c3Oei: c3o,
    c3Training: c3t,
    c4Oei: c4o,
    c4Training: c4t,
    c5Oei: c5o,
    c5Training: c5t,
    category,
    confinedAreaOei: confinedOk,
    confinedAreaTraining: confinedOkT,
    confinedAreaNotGuaranteedOei: confinedNg,
    confinedAreaNotGuaranteedTraining: confinedNgT,
  };
}
