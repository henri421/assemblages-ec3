/**
 * Facteur de correlation beta_w des soudures d angle — EN 1993-1-8:2005
 * tableau 4.1.
 */

import type { Nuance } from '../model/materiau';

const BETA_W: Record<Nuance, number> = {
  S235: 0.8,
  S275: 0.85,
  S355: 0.9,
  S420: 1.0,
  S460: 1.0,
};

/**
 * Facteur de correlation beta_w de la nuance, EN 1993-1-8 tableau 4.1.
 *
 * Il corrige la resistance du metal d apport, reputee superieure a celle du
 * metal de base : c est la nuance la plus faible des pieces assemblees qui le
 * fixe, pas celle du fil.
 */
export function betaW(nuance: Nuance): number {
  const valeur = BETA_W[nuance];
  if (valeur === undefined) {
    throw new Error(`Nuance d acier inconnue : ${String(nuance)}.`);
  }
  return valeur;
}
