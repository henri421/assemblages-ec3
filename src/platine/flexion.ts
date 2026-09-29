/**
 * Flexion transversale de la platine entre les ames, en appui aux
 * extremites.
 *
 * Unites : efforts en kN, longueurs en mm, moments en kN.m, contraintes en MPa.
 *
 * Rien ne porte la platine entre ses appuis : la couronne la charge entre les
 * ames, qui la retiennent. Elle franchit l entraxe e sous la charge N_Ed.
 */

export interface FlexionPlatine {
  /** Largeur utile de platine, parallele aux ames, min(h ; L_w) (mm). */
  w: number;
  /** Borne basse, charge diffusee et continuite aux ames : N e / 8 (kN.m). */
  M_borneBasse: number;
  /** Borne haute, charge concentree et appuis simples : N e / 4 (kN.m). */
  M_borneHaute: number;
  /** Valeur de predimensionnement retenue : N e / 6 (kN.m). */
  M_Ed: number;
}

function positif(v: number, nom: string, unite: string): number {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return v;
}

/**
 * Largeur de platine qui flechit entre les ames, min(h ; L_w).
 *
 * La section de flexion est parallele aux ames : c est la dimension h de la
 * platine qui la mesure, pas b. Au-dela de la longueur des ames, la platine
 * n est plus portee et ne participe pas.
 */
export function largeurUtile(h: number, L_w: number): number {
  return Math.min(positif(h, 'La hauteur de platine h', 'mm'), positif(L_w, 'La longueur d ame L_w', 'mm'));
}

/**
 * Moment de flexion transversale de la platine entre les ames.
 *
 * Le moment se situe entre deux bornes, selon que la charge de la couronne
 * est diffusee et la platine continue sur les ames (N e / 8) ou concentree
 * sur appuis simples (N e / 4). L outil rend LES DEUX et retient N e / 6
 * comme valeur de predimensionnement, en le disant : ce n est pas un
 * resultat de la norme, c est un choix de modele, a reprendre par un modele
 * de plaque des que le taux depasse 0,80.
 *
 * Une charge excentree donne en travee un moment plus faible que la charge
 * centree, dont les bornes sont donc l enveloppe.
 */
export function flexionEntreAmes(N_Ed: number, e: number, h: number, L_w: number): FlexionPlatine {
  const N = positif(N_Ed, 'L effort N_Ed', 'kN');
  const entraxe = positif(e, 'L entraxe des ames e', 'mm');
  const w = largeurUtile(h, L_w);
  // kN * mm -> kN.m
  return {
    w,
    M_borneBasse: (N * entraxe) / 8 / 1000,
    M_borneHaute: (N * entraxe) / 4 / 1000,
    M_Ed: (N * entraxe) / 6 / 1000,
  };
}

export interface CisaillementPlatine {
  /** Effort tranchant au droit de l ame la plus chargee (kN). */
  V_Ed: number;
  /** Contrainte de cisaillement elastique maximale, 1,5 V / (w t) (MPa). */
  tau_Ed: number;
  /** f_y / (racine(3) gamma_M0) (MPa). */
  tau_Rd: number;
  taux: number;
}

/**
 * Cisaillement de la platine au droit de l ame la plus chargee, en
 * elastique : tau = 1,5 V_Ed / (w t), EN 1993-1-1 §6.2.6(4)-(5).
 *
 * L ame la plus proche du tirant reprend part = 1/2 + |excentrement| / e.
 */
export function cisaillementAuDroitDesAmes(
  N_Ed: number,
  part: number,
  w: number,
  t: number,
  f_y: number,
  gamma_M0: number,
): CisaillementPlatine {
  const V_Ed = positif(N_Ed, 'L effort N_Ed', 'kN') * part;
  const tau_Ed = (1.5 * V_Ed * 1000) / (positif(w, 'La largeur utile w', 'mm') * positif(t, 'L epaisseur de platine t', 'mm'));
  const tau_Rd = positif(f_y, 'La limite elastique f_y', 'MPa') / (Math.sqrt(3) * gamma_M0);
  return { V_Ed, tau_Ed, tau_Rd, taux: tau_Ed / tau_Rd };
}
