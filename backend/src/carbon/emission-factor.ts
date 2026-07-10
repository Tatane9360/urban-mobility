import { TransportMode } from '../common/transport-mode.enum';

// ponytail: g CO2e/km per passenger, hard-coded per Transport Mode — no
// per-line/vehicle variation at MVP (see CONTEXT.md, "Facteur d'émission").
// Source: ADEME Base Carbone, "Transport de voyageurs" category, national
// average values per mode:
// - Tram: light rail, France average (~3.4 gCO2e/km/passenger)
// - Bus: urban bus, France average occupancy (~103 gCO2e/km/passenger)
// - Vélo / Marche: no direct emissions (usage phase)
export const EMISSION_FACTORS_G_PER_KM: Record<TransportMode, number> = {
  [TransportMode.Tram]: 3.4,
  [TransportMode.Bus]: 103,
  [TransportMode.Velo]: 0,
  [TransportMode.Marche]: 0,
};

// ponytail: ADEME Base Carbone, "voiture particulière" average French fleet,
// single occupant — the comparison baseline required by the PRD ("gain
// affiché" vs. individual car for the same trip).
export const CAR_EMISSION_FACTOR_G_PER_KM = 193;

export interface CarComparison {
  carCarbonGrams: number;
  savedCarbonGrams: number;
  savedPercent: number;
}
