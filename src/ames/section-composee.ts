/**
 * Section en te formee d une ame et de sa platine participante.
 *
 * Unites : longueurs en mm, aires en mm2, inerties en mm4.
 *
 * Repere : z = 0 sur la face de la platine au contact du support, z croissant
 * vers le chant libre de l ame. Platine sur [0 ; t], ame sur [t ; t + h_w].
 */

import type { Platine, Plats } from '../model/assemblage';
import { epsilon } from '../norms/acier';

export interface SectionEnTe {
  /** Largeur participante de platine cote tirant (mm). */
  b_int: number;
  /** Largeur participante de platine cote bord (mm). */
  b_ext: number;
  /** Largeur totale de la semelle, t_w + b_int + b_ext (mm). */
  B_f: number;
  /** Aire (mm2). */
  A: number;
  /** Position de l axe neutre (mm). */
  z_G: number;
  /** Inertie (mm4). */
  I: number;
  /** Moment statique de la semelle (platine) par rapport a l axe neutre (mm3). */
  S_f: number;
  /** Module elastique cote platine, fibre z = 0 (mm3). */
  W_platine: number;
  /** Module elastique cote chant libre, fibre z = t + h_w (mm3). */
  W_chant: number;
  /** Largeur participante limite, min(e/4 ; 15 eps t) (mm). */
  b_eff_max: number;
  /** Vrai si le percage a ete deduit de la largeur cote tirant. */
  percageDeduit: boolean;
}

function positif(v: number, nom: string): number {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (mm).`);
  }
  return v;
}

/**
 * Section en te d une ame et de sa platine participante.
 *
 * Largeur participante de platine de part et d autre de l ame :
 *   b_eff = min( e/4 ; 15 eps t ),
 * a l image de la largeur de platine associee a un raidisseur (EN 1993-1-5
 * §9.1(2), 15 eps t) et bornee par le quart de l entraxe pour que les deux
 * tes ne se disputent pas la meme platine. Cote bord, elle est en outre
 * bornee par le debord de la platine au-dela de l ame.
 *
 * `auDroitDuPercage` : la section de moment maximal passe par le percage.
 * Celui-ci retire de la largeur participante cote tirant tout ce qui se
 * trouve a moins de d_0/2 de l axe.
 */
export function sectionEnTe(
  platine: Platine,
  plats: Plats,
  f_y_platine: number,
  auDroitDuPercage: boolean,
): SectionEnTe {
  const t = positif(platine.t, 'L epaisseur de platine t');
  const b = positif(platine.b, 'La largeur de platine b');
  const t_w = positif(plats.t_w, 'L epaisseur d ame t_w');
  const h_w = positif(plats.h_w, 'La hauteur d ame h_w');
  const e = positif(plats.e, 'L entraxe des ames e');
  if (!Number.isFinite(platine.d_0) || platine.d_0 < 0) {
    throw new Error('Le diametre du percage d_0 doit etre un nombre positif ou nul (mm).');
  }
  if (e <= t_w) {
    throw new Error("L entraxe des ames e doit depasser l epaisseur d ame t_w (mm).");
  }
  if (b < e + t_w) {
    throw new Error('La largeur de platine b doit couvrir les deux ames, b >= e + t_w (mm).');
  }

  const b_eff_max = Math.min(e / 4, 15 * epsilon(f_y_platine) * t);
  let b_int = b_eff_max;
  const b_ext = Math.min(b_eff_max, (b - e) / 2 - t_w / 2);

  let percageDeduit = false;
  if (auDroitDuPercage) {
    // Bord interieur de la largeur participante, compte depuis l axe du tirant.
    const bordInterieur = e / 2 - t_w / 2 - b_int;
    const empietement = platine.d_0 / 2 - bordInterieur;
    if (empietement > 0) {
      b_int = Math.max(0, b_int - empietement);
      percageDeduit = true;
    }
  }

  const B_f = t_w + b_int + b_ext;
  const A_f = B_f * t;
  const A_w = h_w * t_w;
  const A = A_f + A_w;
  const z_G = (A_f * (t / 2) + A_w * (t + h_w / 2)) / A;
  const I =
    (B_f * t ** 3) / 12 +
    A_f * (z_G - t / 2) ** 2 +
    (t_w * h_w ** 3) / 12 +
    A_w * (t + h_w / 2 - z_G) ** 2;
  const S_f = Math.abs(A_f * (z_G - t / 2));

  return {
    b_int,
    b_ext,
    B_f,
    A,
    z_G,
    I,
    S_f,
    W_platine: I / z_G,
    W_chant: I / (t + h_w - z_G),
    b_eff_max,
    percageDeduit,
  };
}
