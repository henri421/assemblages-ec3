/**
 * Gorge de pleine resistance d une double soudure d angle en te.
 *
 *   a_min = t_w * f_y * beta_w * gamma_M2 / ( racine(2) * f_u * gamma_M0 )
 *
 * Unites : longueurs en mm, contraintes en MPa.
 */

/** Seuil de gorge au-dela duquel une penetration devient plus economique (-). */
export const RAPPORT_GORGE_PENETRATION = 0.7;

export interface DonneesPleineResistance {
  /** Epaisseur du plat attache (mm). */
  t_w: number;
  /** Limite elastique du plat attache (MPa). */
  f_y: number;
  /** Resistance ultime de la piece la plus faible (MPa). */
  f_u: number;
  beta_w: number;
  gamma_M0: number;
  gamma_M2: number;
}

export interface ResultatPleineResistance {
  /** Gorge qui developpe la resistance du plat, par cordon (mm). */
  a_min: number;
  /** a_min / t_w (-). */
  rapport: number;
  /** Vrai quand a_min depasse 0,7 t_w. */
  penetrationPlusEconomique: boolean;
}

/**
 * Gorge de chacun des deux cordons d angle qui transmet la pleine resistance
 * en traction du plat attache, t_w f_y / gamma_M0 par unite de longueur.
 * EN 1993-1-8 §4.5.3.2(6), premier critere, applique a sigma_perp = tau_perp.
 *
 * Derivation : chaque cordon recoit p = t_w f_y / (2 gamma_M0) ; dans la
 * gorge, sigma_perp = tau_perp = p / (racine(2) a), d ou une contrainte
 * equivalente racine(2) p / a, a borner par f_u / (beta_w gamma_M2). Le second
 * critere, 0,9 f_u / gamma_M2, ne gouverne jamais ici : il exigerait moins de
 * 0,56 fois cette gorge, et beta_w >= 0,8.
 *
 * Soit environ 0,46 t_w en S235 et 0,55 t_w en S355 (t <= 40 mm).
 *
 * L outil CONSTATE : il rend la gorge qui satisfait l inequation, et signale
 * qu au-dela de 0,7 t_w une soudure a penetration partielle ou totale devient
 * plus economique et supprime la discontinuite de racine. Il ne la prescrit pas.
 */
export function gorgePleineResistance(d: DonneesPleineResistance): ResultatPleineResistance {
  const champs: Array<[number, string, string]> = [
    [d.t_w, 'L epaisseur du plat t_w', 'mm'],
    [d.f_y, 'La limite elastique f_y', 'MPa'],
    [d.f_u, 'La resistance ultime f_u', 'MPa'],
    [d.beta_w, 'Le facteur de correlation beta_w', '-'],
    [d.gamma_M0, 'Le coefficient gamma_M0', '-'],
    [d.gamma_M2, 'Le coefficient gamma_M2', '-'],
  ];
  for (const [v, nom, unite] of champs) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
    }
  }

  const a_min = (d.t_w * d.f_y * d.beta_w * d.gamma_M2) / (Math.SQRT2 * d.f_u * d.gamma_M0);
  const rapport = a_min / d.t_w;
  return { a_min, rapport, penetrationPlusEconomique: rapport > RAPPORT_GORGE_PENETRATION };
}
