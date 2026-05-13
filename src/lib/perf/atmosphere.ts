// Pure atmospheric / ISA math. Port of lib/performance/atmosphere.dart.
//
// Mirrors the small helper functions at the top of the VBA module:
//   linear_interpolation, Delta_ISA, Standard_Decay

/** Maximum allowed |OAT - ISA| before the chart domain is considered invalid. */
export const MAX_ISA_DEVIATION = 35.0;

/** VBA: linear_interpolation(X, xa, xb, ya, yb). */
export function linearInterpolation(
  x: number,
  xa: number,
  xb: number,
  ya: number,
  yb: number,
): number {
  if (xa === xb) return ya;
  return ya + (x - xa) * ((yb - ya) / (xb - xa));
}

/** VBA: Delta_ISA(PA, OAT). OAT deviation from ISA in °C. */
export function deltaIsa(pressureAltitude: number, oat: number): number {
  const isaTemp = 15.0 - (pressureAltitude / 1000.0) * 2.0;
  return oat - isaTemp;
}

/**
 * True if (PA, OAT) is outside the ISA window.
 * VBA only rejects when OAT exceeds ISA + 35°C — cold conditions are kept.
 */
export function isOutsideIsa(pressureAltitude: number, oat: number): boolean {
  return deltaIsa(pressureAltitude, oat) > MAX_ISA_DEVIATION;
}

/** VBA: Standard_Decay(Ref_PA, PA, Ref_OAT). Standard -2°C/1000 ft lapse. */
export function standardDecay(
  refPa: number,
  newPa: number,
  refOat: number,
): number {
  return refOat - ((newPa - refPa) / 1000.0) * 2.0;
}

/** VBA: Zp = Altitude - (QNH - 1013) * 28 */
export function pressureAltitudeFromQnh(
  indicatedAltitude: number,
  qnh: number,
): number {
  return indicatedAltitude - (qnh - 1013.0) * 28.0;
}
