/**
 * Resistance de la platine au droit du percage.
 *
 *   M_Rd,net = (w - d_0) * t^2 * f_y / (4 * gamma_M0)
 *
 * Unites : longueurs en mm, contraintes en MPa, moments en kN.m.
 */

import type { FlexionPlatine } from './flexion';

/** Taux au-dela duquel le modele de poutre ne suffit plus (-). */
export const SEUIL_MODELE_DE_PLAQUE = 0.8;

export interface ResultatSectionNette {
  /** Largeur nette w - d_0 (mm). */
  largeurNette: number;
  /** Moment resistant plastique de la section nette (kN.m). */
  M_Rd_net: number;
  /** Taux sous la valeur de predimensionnement N e / 6 (-). */
  taux: number;
  /** Taux sous chacune des bornes (-). */
  tauxBorneBasse: number;
  tauxBorneHaute: number;
  /** Vrai au-dela de 0,80 : un modele de plaque est necessaire. */
  modeleDePlaqueNecessaire: boolean;
}

/**
 * Flexion de la platine au droit du percage, EN 1993-1-1 §6.2.5.
 *
 * POINT DIMENSIONNANT DANS LA MAJORITE DES CAS : le percage se trouve a
 * mi-portee entre les ames, c est-a-dire au droit du moment maximal. Section
 * pleine rectangulaire de classe 1, plastification totale admise :
 * W_pl = (w - d_0) t^2 / 4.
 */
export function verifierSectionNette(
  flexion: FlexionPlatine,
  d_0: number,
  t: number,
  f_y: number,
  gamma_M0: number,
): ResultatSectionNette {
  if (!Number.isFinite(d_0) || d_0 < 0) {
    throw new Error('Le diametre du percage d_0 doit etre un nombre positif ou nul (mm).');
  }
  if (!Number.isFinite(t) || t <= 0) {
    throw new Error('L epaisseur de platine t doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(f_y) || f_y <= 0) {
    throw new Error('La limite elastique f_y doit etre un nombre strictement positif (MPa).');
  }
  const largeurNette = flexion.w - d_0;
  if (largeurNette <= 0) {
    throw new Error('Le percage d_0 doit etre plus petit que la largeur utile de platine w (mm).');
  }
  // N.mm -> kN.m
  const M_Rd_net = (largeurNette * t ** 2 * f_y) / (4 * gamma_M0) / 1e6;
  const taux = flexion.M_Ed / M_Rd_net;
  return {
    largeurNette,
    M_Rd_net,
    taux,
    tauxBorneBasse: flexion.M_borneBasse / M_Rd_net,
    tauxBorneHaute: flexion.M_borneHaute / M_Rd_net,
    modeleDePlaqueNecessaire: taux > SEUIL_MODELE_DE_PLAQUE,
  };
}
