/**
 * Boulons : classes de qualite et dimensions.
 *
 * Unites : mm, mm2, MPa.
 *
 * f_yb et f_ub : EN 1993-1-8 tableau 3.1, valeurs nominales.
 * Aire resistante A_s : EN ISO 898-1 (filetage a pas gros).
 * Diametre de trou d_0 : trous normaux, jeu nominal de l'EN 1090-2
 * tableau 11 (1 mm jusqu'a M14, 2 mm de M16 a M24, 3 mm au-dela).
 */

export type ClasseBoulon = '4.6' | '4.8' | '5.6' | '5.8' | '6.8' | '8.8' | '10.9';

export const CLASSES_BOULON: readonly ClasseBoulon[] = ['4.6', '4.8', '5.6', '5.8', '6.8', '8.8', '10.9'];

const RESISTANCES: Record<ClasseBoulon, { f_yb: number; f_ub: number }> = {
  '4.6': { f_yb: 240, f_ub: 400 },
  '4.8': { f_yb: 320, f_ub: 400 },
  '5.6': { f_yb: 300, f_ub: 500 },
  '5.8': { f_yb: 400, f_ub: 500 },
  '6.8': { f_yb: 480, f_ub: 600 },
  '8.8': { f_yb: 640, f_ub: 800 },
  '10.9': { f_yb: 900, f_ub: 1000 },
};

export type DiametreBoulon = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 27 | 30 | 36;

export const DIAMETRES_BOULON: readonly DiametreBoulon[] = [12, 14, 16, 18, 20, 22, 24, 27, 30, 36];

const AIRE_RESISTANTE: Record<DiametreBoulon, number> = {
  12: 84.3,
  14: 115,
  16: 157,
  18: 192,
  20: 245,
  22: 303,
  24: 353,
  27: 459,
  30: 561,
  36: 817,
};

/** f_yb et f_ub (MPa), EN 1993-1-8 tableau 3.1. */
export function resistancesBoulon(classe: ClasseBoulon): { f_yb: number; f_ub: number } {
  const r = RESISTANCES[classe];
  if (r === undefined) throw new Error(`Classe de boulon inconnue : ${String(classe)}.`);
  return r;
}

/** Aire resistante A_s (mm2) et aire brute de la tige A (mm2). */
export function airesBoulon(d: DiametreBoulon): { A_s: number; A: number } {
  const A_s = AIRE_RESISTANTE[d];
  if (A_s === undefined) throw new Error(`Diametre de boulon non tabule : M${String(d)}.`);
  return { A_s, A: (Math.PI * d * d) / 4 };
}

/** Diametre de trou normal d_0 (mm), EN 1090-2 tableau 11. */
export function diametreTrou(d: DiametreBoulon): number {
  if (!DIAMETRES_BOULON.includes(d)) throw new Error(`Diametre de boulon non tabule : M${String(d)}.`);
  return d + (d <= 14 ? 1 : d <= 24 ? 2 : 3);
}

/**
 * alpha_v du tableau 3.4 : 0,6 si le plan de cisaillement passe par la tige
 * lisse ; par le filetage, 0,6 pour les classes 4.6, 5.6 et 8.8, 0,5 pour
 * 4.8, 5.8, 6.8 et 10.9.
 */
export function alphaV(classe: ClasseBoulon, filetageDansLePlan: boolean): number {
  if (!filetageDansLePlan) return 0.6;
  return classe === '4.6' || classe === '5.6' || classe === '8.8' ? 0.6 : 0.5;
}
