// Helicopter configuration toggles + EngineRating + HoverMode.
// Port of lib/performance/perf_config.dart.
//
// Engine anti-icing (AI) is NOT a user toggle; it follows OAT (≤ 0°C → on).

export interface PerfConfig {
  /** Air-Sand Filter */
  asf: boolean;
  /** Ice Protection System */
  ips: boolean;
  /** Environmental Control System (cabin air conditioning) */
  ecs: boolean;
  /** Rescue hoist installed */
  hoist: boolean;
  /** Cabin stretcher kit / external attachment */
  hsc: boolean;
  /** Left-hand cabin door open */
  lhDoor: boolean;
  /** Right-hand cabin door open */
  rhDoor: boolean;
}

export function defaultPerfConfig(): PerfConfig {
  return {
    asf: false,
    ips: false,
    ecs: false,
    hoist: false,
    hsc: false,
    lhDoor: false,
    rhDoor: false,
  };
}

/** Engine rating used in performance lookups. String values match VBA filenames. */
export type EngineRating =
  | 'aeoMtop'
  | 'aeoMcp'
  | 'oeiLow'
  | 'oeiMcp'
  | 'trainingOeiLow'
  | 'trainingOeiMcp';

export const ENGINE_RATING_LABEL: Record<EngineRating, string> = {
  aeoMtop: 'AEO MTOP',
  aeoMcp: 'AEO MCP',
  oeiLow: 'OEI LOW',
  oeiMcp: 'OEI MCP',
  trainingOeiLow: 'TRAINING OEI LOW',
  trainingOeiMcp: 'TRAINING OEI MCP',
};

export type HoverMode = 'ige' | 'oge';
export const HOVER_MODE_LABEL: Record<HoverMode, string> = {
  ige: 'IGE',
  oge: 'OGE',
};
