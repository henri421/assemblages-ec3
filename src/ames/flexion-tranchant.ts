/**
 * Flexion et effort tranchant de la poutre en te formee d une ame et de sa
 * platine participante.
 *
 * Unites : efforts en kN, longueurs en mm, moments en kN.m, contraintes en MPa.
 */

import type { SectionEnTe } from './section-composee';

export interface SollicitationsAme {
  /** Moment dans la poutre en te de l ame la plus chargee (kN.m). */
  M_Ed: number;
  /** Effort tranchant correspondant (kN). */
  V_Ed: number;
}

/**
 * Sollicitations de l ame la plus chargee en APPUI CONTINU.
 *
 * L ame collecte la pression d appui q = sigma_c w_s sur sa longueur et la
 * ramene vers la zone de la couronne, qui la porte : chaque moitie est une
 * console de longueur l = (L_w - D) / 2 sous charge uniforme.
 *   M = q l^2 / 2,  V = q l.
 * La console releve les extremites : la platine est tendue, le chant libre
 * comprime.
 */
export function sollicitationsContinu(sigma_c: number, w_s: number, L_w: number, D: number): SollicitationsAme {
  const q = sigma_c * w_s; // N/mm
  const l = Math.max(0, (L_w - D) / 2);
  return { M_Ed: (q * l ** 2) / 2 / 1e6, V_Ed: (q * l) / 1000 };
}

/**
 * Sollicitations de l ame la plus chargee en APPUI AUX EXTREMITES : poutre
 * sur deux appuis de portee L, charge concentree a mi-portee.
 *   M = part N L / 4,  V = part N / 2.
 */
export function sollicitationsExtremites(N_Ed: number, part: number, L: number): SollicitationsAme {
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error('La portee L doit etre un nombre strictement positif (mm).');
  }
  return { M_Ed: (part * N_Ed * L) / 4 / 1000, V_Ed: (part * N_Ed) / 2 };
}

export interface ResultatFlexionTranchant extends SollicitationsAme {
  /** Resistance elastique, min(W_platine f_y,p ; W_chant f_y,w) / gamma_M0 (kN.m). */
  M_el_Rd: number;
  /** Resistance plastique au cisaillement de l ame, h_w t_w f_y / (racine(3) gamma_M0) (kN). */
  V_pl_Rd: number;
  /** Vrai si V_Ed > 0,5 V_pl,Rd (EN 1993-1-1 §6.2.8(2)). */
  interactionMV: boolean;
  /** Reduction rho = (2 V / V_pl,Rd - 1)^2 (-), 0 sans interaction. */
  rho: number;
  /** Resistance en flexion reduite, M_el,Rd (1 - rho) (kN.m). */
  M_V_Rd: number;
  tauxFlexion: number;
  tauxTranchant: number;
  /** Contrainte au chant libre, compression positive (MPa). */
  sigma_chant: number;
  /** Contrainte au pied de l ame (z = t), compression positive (MPa). */
  sigma_pied: number;
  /** Contrainte a la face de la platine au contact du support, traction positive (MPa). */
  sigma_platine: number;
}

/**
 * Flexion et tranchant de la poutre en te, EN 1993-1-1 §6.2.5, §6.2.6 et
 * §6.2.8.
 *
 * Resistance ELASTIQUE en flexion, meme quand la section serait de classe 1
 * ou 2 : la reserve plastique d une section en te dissymetrique est faible,
 * et la retenir exigerait une classification complete de la platine en
 * console, que le modele de largeur participante (15 eps t) ne fournit pas.
 *
 * Interaction : l EN 1993-1-1 §6.2.8(3) reduit f_y sur l aire cisaillee. On
 * reduit ici TOUTE la resistance en flexion du facteur (1 - rho) :
 * simplification conservative, qui dispense de recalculer une section a
 * limite elastique variable.
 */
export function verifierFlexionTranchant(
  s: SollicitationsAme,
  section: SectionEnTe,
  t: number,
  h_w: number,
  t_w: number,
  f_y_platine: number,
  f_y_ame: number,
  gamma_M0: number,
): ResultatFlexionTranchant {
  const M_el_Rd = Math.min(section.W_platine * f_y_platine, section.W_chant * f_y_ame) / gamma_M0 / 1e6;
  const V_pl_Rd = (h_w * t_w * f_y_ame) / (Math.sqrt(3) * gamma_M0) / 1000;
  const interactionMV = s.V_Ed > 0.5 * V_pl_Rd;
  const rho = interactionMV ? (2 * s.V_Ed / V_pl_Rd - 1) ** 2 : 0;
  const M_V_Rd = M_el_Rd * (1 - rho);

  const M = s.M_Ed * 1e6; // N.mm
  const sigma_chant = (M * (t + h_w - section.z_G)) / section.I;
  const sigma_pied = (M * (t - section.z_G)) / section.I;
  const sigma_platine = (M * section.z_G) / section.I;

  return {
    ...s,
    M_el_Rd,
    V_pl_Rd,
    interactionMV,
    rho,
    M_V_Rd,
    tauxFlexion: s.M_Ed / M_V_Rd,
    tauxTranchant: s.V_Ed / V_pl_Rd,
    sigma_chant,
    sigma_pied,
    sigma_platine,
  };
}
