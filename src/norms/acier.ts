/**
 * Resistances nominales de l acier — EN 1993-1-1:2005 tableau 3.1.
 *
 * Unites : epaisseurs en mm, contraintes en MPa.
 *
 * S235 a S355 : EN 10025-2. S420 et S460 : EN 10025-3 (N/NL).
 */

import type { Nuance } from '../model/materiau';

interface Palier {
  f_y: number;
  f_u: number;
}

/** Deux paliers d epaisseur : t <= 40 mm et 40 < t <= 80 mm. */
const TABLE: Record<Nuance, [Palier, Palier]> = {
  S235: [
    { f_y: 235, f_u: 360 },
    { f_y: 215, f_u: 360 },
  ],
  S275: [
    { f_y: 275, f_u: 430 },
    { f_y: 255, f_u: 410 },
  ],
  S355: [
    { f_y: 355, f_u: 510 },
    { f_y: 335, f_u: 470 },
  ],
  S420: [
    { f_y: 420, f_u: 520 },
    { f_y: 390, f_u: 520 },
  ],
  S460: [
    { f_y: 460, f_u: 540 },
    { f_y: 430, f_u: 540 },
  ],
};

/** Epaisseur maximale couverte par le tableau 3.1. */
export const EPAISSEUR_MAXIMALE = 80;

function palier(nuance: Nuance, t: number): Palier {
  if (!Number.isFinite(t) || t <= 0) {
    throw new Error('L epaisseur t doit etre un nombre strictement positif (mm).');
  }
  if (t > EPAISSEUR_MAXIMALE) {
    // Au-dela de 80 mm, le tableau 3.1 ne donne rien : extrapoler serait
    // inventer une valeur de norme.
    throw new Error(
      `L epaisseur ${t} mm depasse 80 mm, limite du tableau 3.1 de l EN 1993-1-1 (mm).`,
    );
  }
  const paliers = TABLE[nuance];
  if (paliers === undefined) {
    throw new Error(`Nuance d acier inconnue : ${String(nuance)}.`);
  }
  return t <= 40 ? paliers[0] : paliers[1];
}

/** Limite d elasticite nominale f_y (MPa), EN 1993-1-1 tableau 3.1. */
export function limiteElastique(nuance: Nuance, t: number): number {
  return palier(nuance, t).f_y;
}

/** Resistance ultime nominale f_u (MPa), EN 1993-1-1 tableau 3.1. */
export function resistanceUltime(nuance: Nuance, t: number): number {
  return palier(nuance, t).f_u;
}

/** Coefficient epsilon = racine(235 / f_y), EN 1993-1-1 tableau 5.2. */
export function epsilon(f_y: number): number {
  if (!Number.isFinite(f_y) || f_y <= 0) {
    throw new Error('La limite elastique f_y doit etre un nombre strictement positif (MPa).');
  }
  return Math.sqrt(235 / f_y);
}
