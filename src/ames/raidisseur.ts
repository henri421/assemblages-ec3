/**
 * Stabilite locale des ames, raidisseurs plats a chant libre comprime.
 *
 * Unites : longueurs en mm, contraintes en MPa.
 *
 * Dans les deux schemas, la platine est la semelle TENDUE de la poutre en te
 * et le chant libre de l ame la fibre COMPRIMEE : c est lui qui peut se
 * derober.
 */

import { epsilon } from '../norms/acier';

export interface ClasseAme {
  /** Elancement c / t = h_w / t_w (-). */
  elancement: number;
  /** Rapport des contraintes pied / chant, compression positive (-). */
  psi: number;
  /** Coefficient de voilement, EN 1993-1-5 tableau 4.2 (-). */
  k_sigma: number;
  /** Limite de la classe 3, 21 eps racine(k_sigma) (-). */
  limiteClasse3: number;
  /** Vrai si l ame est au plus de classe 3. */
  classe3Atteinte: boolean;
}

/**
 * Classe de l ame, paroi en console dont le bord libre est le plus comprime —
 * EN 1993-1-1 tableau 5.2 (feuille 2) et EN 1993-1-5 tableau 4.2.
 *
 *   k_sigma = 0,57 - 0,21 psi + 0,07 psi^2,   1 >= psi >= -3
 *   classe 3 : c / t <= 21 eps racine(k_sigma)
 *
 * c est pris egal a h_w, sans deduire le pied de cordon : c est l hypothese
 * defavorable. psi est borne a -3, limite de validite de l expression ;
 * k_sigma croissant quand psi decroit, la borne est conservative.
 *
 * `sigma_pied` et `sigma_chant` sont les contraintes au pied et au chant libre,
 * COMPRESSION POSITIVE. Un chant libre non comprime n a pas de classe a
 * verifier : l ame est alors reputee de classe 1.
 */
export function classeAme(
  h_w: number,
  t_w: number,
  f_y: number,
  sigma_pied: number,
  sigma_chant: number,
): ClasseAme {
  if (!Number.isFinite(h_w) || h_w <= 0) {
    throw new Error('La hauteur d ame h_w doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(t_w) || t_w <= 0) {
    throw new Error('L epaisseur d ame t_w doit etre un nombre strictement positif (mm).');
  }
  const elancement = h_w / t_w;
  if (!(sigma_chant > 0)) {
    return { elancement, psi: Number.NaN, k_sigma: Number.NaN, limiteClasse3: Infinity, classe3Atteinte: true };
  }
  const psi = Math.max(-3, Math.min(1, sigma_pied / sigma_chant));
  const k_sigma = 0.57 - 0.21 * psi + 0.07 * psi ** 2;
  const limiteClasse3 = 21 * epsilon(f_y) * Math.sqrt(k_sigma);
  return { elancement, psi, k_sigma, limiteClasse3, classe3Atteinte: elancement <= limiteClasse3 };
}

export interface TorsionRaidisseur {
  elancement: number;
  /** racine(E / (5,3 f_y)) (-). */
  limite: number;
  taux: number;
}

/**
 * Voilement par torsion d un raidisseur plat — EN 1993-1-5 §9.2.1(8).
 *
 *   I_T / I_p >= 5,3 f_y / E
 *
 * Pour un plat h_w x t_w soude par un chant, I_T = h_w t_w^3 / 3 et
 * I_p = h_w^3 t_w / 3 autour du pied, d ou h_w / t_w <= racine(E / (5,3 f_y)),
 * soit environ 13 eps.
 *
 * C est ce critere qui couvre ici le deversement : la fibre comprimee est le
 * chant libre de l ame, que rien ne tient lateralement. Tant qu il est
 * satisfait, la rotation de l ame autour de son pied — mode par lequel ce
 * chant se deroberait — est exclue sans calcul de torsion, la rigidite de
 * gauchissement etant negligee.
 */
export function torsionRaidisseur(h_w: number, t_w: number, f_y: number, E: number): TorsionRaidisseur {
  if (!Number.isFinite(f_y) || f_y <= 0) {
    throw new Error('La limite elastique f_y doit etre un nombre strictement positif (MPa).');
  }
  if (!Number.isFinite(E) || E <= 0) {
    throw new Error('Le module d elasticite E doit etre un nombre strictement positif (MPa).');
  }
  const elancement = h_w / t_w;
  const limite = Math.sqrt(E / (5.3 * f_y));
  return { elancement, limite, taux: elancement / limite };
}
