// AssetResolver + filename builders. Port of lib/performance/asset_resolver.dart.
//
// The Flutter app scanned the runtime AssetManifest; the Svelte version uses
// a static manifest.json generated at build time (see
// tools/build-data-manifest.mjs).

import {
  ENGINE_RATING_LABEL,
  HOVER_MODE_LABEL,
  type EngineRating,
  type HoverMode,
  type PerfConfig,
} from './perfConfig';

export class AssetResolver {
  /**
   * Key format: filename without figure-prefix, spaces replaced with
   * underscores, upper-cased. Maps to the URL path served from /data/.
   */
  private readonly index: Map<string, string>;

  private constructor(index: Map<string, string>) {
    this.index = index;
  }

  /** Build a resolver by fetching /data/manifest.json. */
  static async create(baseUrl = '/data'): Promise<AssetResolver> {
    let files: string[];
    try {
      const res = await fetch(`${baseUrl}/manifest.json`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      files = await res.json();
    } catch (e) {
      console.warn(`AssetResolver: failed to load manifest.json — ${e}`);
      files = [];
    }
    const index = new Map<string, string>();
    for (const relPath of files) {
      if (!relPath.toLowerCase().endsWith('.dat')) continue;
      const filename = relPath.split('/').pop()!;
      const stripped = stripFigurePrefix(filename);
      const key = stripped.replace(/ /g, '_').toUpperCase();
      index.set(key, `${baseUrl}/${relPath}`);
    }
    return new AssetResolver(index);
  }

  /** Manually-constructed resolver (used in tests). */
  static fromIndex(index: Record<string, string>): AssetResolver {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(index)) m.set(k.toUpperCase(), v);
    return new AssetResolver(m);
  }

  /**
   * VBA filename → URL. Accepts either the space-separated or
   * underscore-separated form; returns null if unregistered.
   */
  resolve(vbaFilename: string): string | null {
    const stripped = stripFigurePrefix(vbaFilename);
    const key = stripped.replace(/ /g, '_').toUpperCase();
    return this.index.get(key) ?? null;
  }

  /** All registered .dat URLs (debugging / diagnostics). */
  registeredFiles(): IterableIterator<string> {
    return this.index.keys();
  }
}

function stripFigurePrefix(name: string): string {
  // Match patterns like "9-58_-_", "9-130 - ", "9-58 - " at the start.
  return name.replace(/^\d+-\d+[_ ]?-[_ ]?/, '');
}

// ─── FILENAME BUILDERS ─────────────────────────────────────────────────────

/** Computed filename tokens based on configuration + flight conditions. */
export interface FileTokens {
  /** "" / " ASF" / " IPS ASF" / " IPS ON BEFORE ICING" / " IPS" */
  asfIps: string;
  /** "" / "ASF\\" / "IPS\\" / "ASF + IPS\\" — folder under DATA/ (legacy; unused for filename match) */
  asfIpsFolder: string;
  /** " ECS ON" / " ECS OFF" */
  ecsStatus: string;
  /** " AI ON" / " AI OFF" */
  engineAntiIcing: string;
}

const EMPTY_TOKENS: FileTokens = {
  asfIps: '',
  asfIpsFolder: '',
  ecsStatus: '',
  engineAntiIcing: '',
};

export const emptyTokens: FileTokens = EMPTY_TOKENS;

function asfIpsForRoc(cfg: PerfConfig, oat: number): string {
  if (cfg.asf && cfg.ips) return oat <= 0 ? ' IPS ASF' : ' ASF';
  if (cfg.asf) return ' ASF';
  if (cfg.ips) return oat <= 0 ? ' IPS' : '';
  return '';
}

function asfIpsForHover(cfg: PerfConfig, oat: number): string {
  if (cfg.asf && cfg.ips) return oat <= 0 ? ' IPS ASF' : ' ASF';
  if (cfg.asf) return ' ASF';
  if (cfg.ips) return oat <= 0 ? ' IPS ON BEFORE ICING' : '';
  return '';
}

function asfIpsFolder(cfg: PerfConfig, oat: number): string {
  if (cfg.asf && cfg.ips) return oat <= 0 ? 'ASF + IPS\\' : 'ASF\\';
  if (cfg.asf) return 'ASF\\';
  if (cfg.ips) return oat <= 0 ? 'IPS\\' : '';
  return '';
}

function isOeiRating(r: EngineRating | undefined): boolean {
  return (
    r === 'oeiLow' ||
    r === 'oeiMcp' ||
    r === 'trainingOeiLow' ||
    r === 'trainingOeiMcp'
  );
}

function isTrainingRating(r: EngineRating | undefined): boolean {
  return r === 'trainingOeiLow' || r === 'trainingOeiMcp';
}

/** Tokens for the hover-style filename pattern. */
export function tokensForHover(
  cfg: PerfConfig,
  oat: number,
  rating?: EngineRating,
): FileTokens {
  const ecsForced = isOeiRating(rating);
  const ecsStatus = cfg.ecs && !ecsForced ? ' ECS ON' : ' ECS OFF';
  const aiStatus = oat <= 0 ? ' AI ON' : ' AI OFF';
  return {
    asfIps: asfIpsForHover(cfg, oat),
    asfIpsFolder: asfIpsFolder(cfg, oat),
    ecsStatus,
    engineAntiIcing: aiStatus,
  };
}

/** Tokens for the rate-of-climb / height-loss filename pattern. */
export function tokensForRoc(
  cfg: PerfConfig,
  oat: number,
  rating?: EngineRating,
): FileTokens {
  const ecsForced = isOeiRating(rating);
  const isTraining = isTrainingRating(rating);
  const ecsStatus = cfg.ecs && !ecsForced ? ' ECS ON' : ' ECS OFF';
  const aiStatus = isTraining ? ' AI OFF' : oat <= 0 ? ' AI ON' : ' AI OFF';
  return {
    asfIps: asfIpsForRoc(cfg, oat),
    asfIpsFolder: asfIpsFolder(cfg, oat),
    ecsStatus,
    engineAntiIcing: aiStatus,
  };
}

export function hoverFilename(
  mode: HoverMode,
  rating: EngineRating,
  t: FileTokens,
): string {
  return `HOVER ${HOVER_MODE_LABEL[mode]} ${ENGINE_RATING_LABEL[rating]}${t.asfIps}${t.ecsStatus}${t.engineAntiIcing}.dat`;
}

export function rocFilename(
  rating: EngineRating,
  tas: number,
  t: FileTokens,
  part: number,
): string {
  return `RATE OF CLIMB ${ENGINE_RATING_LABEL[rating]} ${tas}KT${t.asfIps}${t.ecsStatus}${t.engineAntiIcing} ${part}.dat`;
}

export function heightLossFilename(t: FileTokens, part: number): string {
  return `HEIGHT LOSS${t.asfIps}${t.ecsStatus}${t.engineAntiIcing} ${part}.dat`;
}

export function heightLossTrainingFilename(
  t: FileTokens,
  part: number,
): string {
  return `HEIGHT LOSS TRAINING${t.asfIps}${t.ecsStatus}${t.engineAntiIcing} ${part}.dat`;
}

export const FILE_WEIGHT_INDEX_0 = 'WEIGHT INDEX 0.dat';
export const FILE_WEIGHT_INDEX_1 = 'WEIGHT INDEX 1.dat';
export const FILE_TAKEOFF_PERF_0 = 'TAKEOFF PERFORMANCE 0.dat';
export const FILE_TAKEOFF_PERF_1 = 'TAKEOFF PERFORMANCE 1.dat';
export const FILE_ROC_DE_RATING = 'ROC DE-RATING.dat';
