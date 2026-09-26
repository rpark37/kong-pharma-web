import { PALETTE } from '../../shared/fui/fui-panels';
import type { LatLon } from '../map/sites';

export type Severity = 'war' | 'high' | 'elevated' | 'moderate';

/**
 * Editorial anchors copied from OSIRIS's `KNOWN_CONFLICTS` (https://github.com/simplifaisoul/osiris,
 * MIT) as of 2026-09. Upstream enriches these live from GDELT; here they are a dated snapshot, and
 * the Info panel says so. `queries` and `bounds` (the GDELT inputs) are dropped.
 */
export interface ConflictZone extends LatLon {
  id: string;
  label: string;
  severity: Severity;
  description: string;
  sourceUrl: string;
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  war: PALETTE.rose,
  high: PALETTE.amber,
  elevated: PALETTE.teal,
  moderate: PALETTE.dim,
};

export const CONFLICT_ZONES: ConflictZone[] = [
  { id: 'ukraine', label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lon: 31.2, description: 'Ongoing Russian invasion of Ukraine — active frontlines across eastern and southern regions.', sourceUrl: 'https://liveuamap.com/' },
  { id: 'gaza', label: 'GAZA CONFLICT', severity: 'war', lat: 31.35, lon: 34.35, description: 'Active military operations and humanitarian crisis in Gaza Strip.', sourceUrl: 'https://israelpalestine.liveuamap.com/' },
  { id: 'lebanon', label: 'LEBANON BORDER', severity: 'high', lat: 33.377, lon: 35.483, description: 'Active cross-border military operations in southern Lebanon.', sourceUrl: 'https://lebanon.liveuamap.com/' },
  { id: 'sudan', label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lon: 30.0, description: 'Armed conflict between SAF and RSF factions across Sudan.', sourceUrl: 'https://sudan.liveuamap.com/' },
  { id: 'myanmar', label: 'MYANMAR CONFLICT', severity: 'war', lat: 19.5, lon: 96.5, description: 'Internal conflict — military junta vs opposition forces.', sourceUrl: 'https://myanmar.liveuamap.com/' },
  { id: 'yemen', label: 'YEMEN WAR', severity: 'war', lat: 15.5, lon: 48.0, description: 'Houthi militant operations, Red Sea maritime threats, and coalition strikes.', sourceUrl: 'https://yemen.liveuamap.com/' },
  { id: 'syria', label: 'SYRIA', severity: 'high', lat: 35.0, lon: 38.5, description: 'Ongoing civil conflict and localized insurgencies.', sourceUrl: 'https://syria.liveuamap.com/' },
  { id: 'drc', label: 'DRC EASTERN CONFLICT', severity: 'war', lat: -1.0, lon: 28.5, description: 'M23 rebel offensive and regional instability in eastern Congo.', sourceUrl: 'https://drc.liveuamap.com/' },
  { id: 'red-sea', label: 'RED SEA THREAT', severity: 'high', lat: 16.0, lon: 40.0, description: 'Houthi anti-ship missile and drone attacks on maritime traffic.', sourceUrl: 'https://yemen.liveuamap.com/' },
  { id: 'taiwan-strait', label: 'TAIWAN STRAIT', severity: 'elevated', lat: 24.0, lon: 119.5, description: 'Elevated military drills and regional tension.', sourceUrl: 'https://china.liveuamap.com/' },
  { id: 'korean-dmz', label: 'KOREAN DMZ', severity: 'elevated', lat: 38.3, lon: 127.0, description: 'Ongoing cross-border tension and military posturing.', sourceUrl: 'https://liveuamap.com/' },
  { id: 'sahel', label: 'SAHEL INSTABILITY', severity: 'high', lat: 14.0, lon: 5.0, description: 'Insurgencies and military coups across Mali, Burkina Faso, Niger.', sourceUrl: 'https://africa.liveuamap.com/' },
  { id: 'somalia', label: 'SOMALIA', severity: 'high', lat: 5.0, lon: 46.0, description: 'Al-Shabaab insurgency and counter-terrorism operations.', sourceUrl: 'https://africa.liveuamap.com/' },
  { id: 'iraq', label: 'IRAQ INSTABILITY', severity: 'elevated', lat: 33.3, lon: 44.4, description: 'Ongoing militia activity and counter-terrorism operations.', sourceUrl: 'https://iraq.liveuamap.com/' },
  { id: 'ethiopia', label: 'ETHIOPIA', severity: 'elevated', lat: 9.0, lon: 38.7, description: 'Ethnic tensions and regional conflicts across multiple regions.', sourceUrl: 'https://africa.liveuamap.com/' },
];
