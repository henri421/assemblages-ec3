/**
 * Poinconnement de la platine autour de la couronne d appui.
 *
 *   tau_Ed = N_Ed / (pi * D * t)  <=  f_y / (racine(3) * gamma_M0)
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 */

export interface ResultatPoinconnementPlatine {
  /** Perimetre cisaille pi D (mm). */
  perimetre: number;
  tau_Ed: number;
  tau_Rd: number;
  taux: number;
}

/**
 * Cisaillement de la platine sur le contour de la couronne, EN 1993-1-1
 * §6.2.6 applique a la section cylindrique pi D t.
 *
 * Tout l effort est suppose traverser ce contour. En appui continu, le beton
 * situe sous la couronne en porte une part directement : l hypothese est
 * conservative, et dispense de la chiffrer.
 */
export function verifierPoinconnementPlatine(
  N_Ed: number,
  D: number,
  t: number,
  f_y: number,
  gamma_M0: number,
): ResultatPoinconnementPlatine {
  const champs: Array<[number, string, string]> = [
    [N_Ed, 'L effort N_Ed', 'kN'],
    [D, 'Le diametre de couronne D', 'mm'],
    [t, 'L epaisseur de platine t', 'mm'],
    [f_y, 'La limite elastique f_y', 'MPa'],
  ];
  for (const [v, nom, unite] of champs) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
    }
  }
  const perimetre = Math.PI * D;
  const tau_Ed = (N_Ed * 1000) / (perimetre * t);
  const tau_Rd = f_y / (Math.sqrt(3) * gamma_M0);
  return { perimetre, tau_Ed, tau_Rd, taux: tau_Ed / tau_Rd };
}
