/**
 * Methode simplifiee — EN 1993-1-8:2005 §4.5.3.3.
 *
 *   F_w,Ed = racine( p_1^2 + p_2^2 + p_para^2 )   resultante lineique
 *   F_w,Rd = a * f_vw,d,   f_vw,d = f_u / (racine(3) * beta_w * gamma_M2)
 *
 * Unites : efforts lineiques en kN/mm, gorge en mm, contraintes en MPa.
 */

import { N_PAR_KN, gorgeValide, type EffortsLineiques } from './gorge';
import { resistanceValide, type ResistanceSoudure } from './directionnelle';

export interface ResultatSimplifie {
  /** Resultante lineique de toutes les forces transmises (kN/mm). */
  F_w_Ed: number;
  /** Resistance de cisaillement de calcul f_vw,d, reduite par beta_Lw (MPa). */
  f_vw_d: number;
  /** Resistance lineique a * f_vw,d (kN/mm). */
  F_w_Rd: number;
  taux: number;
}

/**
 * Verification d un point de cordon par la methode simplifiee,
 * EN 1993-1-8 §4.5.3.3(2) et (3).
 *
 * La methode ignore l orientation de l effort : toute force est traitee comme
 * un cisaillement de la gorge. Elle est donc toujours du cote de la securite,
 * et COINCIDE RIGOUREUSEMENT avec la methode directionnelle en cisaillement
 * longitudinal pur — racine(3) tau_para <= f_u/(beta_w gamma_M2) equivaut a
 * tau_para <= f_vw,d. Un test fixe cette identite.
 */
export function verifierSimplifiee(
  efforts: EffortsLineiques,
  a: number,
  resistance: ResistanceSoudure,
): ResultatSimplifie {
  gorgeValide(a);
  const { f_u, beta_w, gamma_M2, beta_Lw } = resistanceValide(resistance);
  const { p_1, p_2, p_para } = efforts;
  if (![p_1, p_2, p_para].every(Number.isFinite)) {
    throw new Error('Les efforts lineiques du cordon doivent etre des nombres finis (kN/mm).');
  }

  const F_w_Ed = Math.hypot(p_1, p_2, p_para);
  const f_vw_d = (beta_Lw * f_u) / (Math.sqrt(3) * beta_w * gamma_M2);
  const F_w_Rd = (a * f_vw_d) / N_PAR_KN;
  return { F_w_Ed, f_vw_d, F_w_Rd, taux: F_w_Ed / F_w_Rd };
}
