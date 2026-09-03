import { TransportMode } from '../common/transport-mode.enum';

// g CO2e/km per passenger, per Transport Mode — no per-line or per-vehicle
// variation. Source: ADEME Base Carbone, "Transport de voyageurs", national
// averages:
// - Tram: light rail, France average (~3.4 gCO2e/km/passenger)
// - Bus: urban bus, France average occupancy (~103 gCO2e/km/passenger)
// - Vélo / Marche: no direct emissions (usage phase)
export const EMISSION_FACTORS_G_PER_KM: Record<TransportMode, number> = {
  [TransportMode.Tram]: 3.4,
  [TransportMode.Bus]: 103,
  [TransportMode.Velo]: 0,
  [TransportMode.Marche]: 0,
};

// ADEME Base Carbone, "voiture particulière", average French fleet, single
// occupant. The baseline every "saved vs. car" figure is computed against.
export const CAR_EMISSION_FACTOR_G_PER_KM = 193;

export interface CarComparison {
  carCarbonGrams: number;
  savedCarbonGrams: number;
  savedPercent: number;
}
