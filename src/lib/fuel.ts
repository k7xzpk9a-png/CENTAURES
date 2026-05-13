// Shared required-fuel formula. Used by both Fuel and Configuration so they
// can't drift. Mirrors the formula in Flutter's main.dart _maybeAutoUpdateFuel.

import { legCruiseFuel, vyFF, type CruiseFFTable } from './ffTable';

export interface RequiredFuelInputs {
  distOut: number; // nm
  distIn: number; // nm
  gsOut: number; // kt
  gsIn: number; // kt
  playtimeMin: number;
  reserveKg: number;
  table: CruiseFFTable;
}

export function computeRequiredFuel(o: RequiredFuelInputs): number {
  return (
    legCruiseFuel(o.distOut, o.gsOut, o.table) +
    legCruiseFuel(o.distIn, o.gsIn, o.table) +
    (vyFF(o.table) / 60) * o.playtimeMin +
    o.reserveKg
  );
}
