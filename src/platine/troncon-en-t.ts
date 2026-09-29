/**
 * Appui de la platine sur le beton — troncon en te equivalent comprime,
 * EN 1993-1-8:2005 §6.2.5.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 *
 *   f_jd = beta_j * k_j * f_cd,   f_cd = f_ck / gamma_c
 *   c    = t * racine( f_y / (3 f_jd gamma_M0) )
 *   N    <= A_eff * f_jd
 *
 * Repere de la platine : x parallele aux ames (dimension h), y perpendiculaire
 * (dimension b), origine au centre de la platine. Les ames sont centrees en
 * x et placees en y = +-e/2 ; la couronne et le percage sont centres en
 * (0, excentrement).
 */

import type { Assemblage } from '../model/assemblage';
import type { ProfilEC3 } from '../norms/ec3-recommande';

export interface ResultatTronconEnT {
  /** Resistance de calcul du beton, f_ck / gamma_c (MPa). */
  f_cd: number;
  /** Resistance d appui, beta_j k_j f_cd (MPa). */
  f_jd: number;
  /** Largeur d appui additionnelle (mm). */
  c: number;
  /** Espace libre entre l empreinte de la couronne et l ame la plus proche (mm). */
  g: number;
  /** Vrai si les ames sont comptees dans le contour rigide. */
  amesDansLeContour: boolean;
  /** Pourquoi elles ne le sont pas ; null si elles le sont. */
  motifAmesExclues: string | null;
  /** Aire d appui efficace (mm2) : totale en appui continu, par extremite sinon. */
  A_eff: number;
  /** Effort porte par cette aire (kN). */
  N_appui: number;
  /** Resistance d appui A_eff f_jd (kN). */
  F_c_Rd: number;
  /** Pression moyenne sous l aire efficace, N_appui / A_eff (MPa). */
  sigma_c: number;
  taux: number;
  /**
   * Appui continu : largeur de platine dont chaque ame collecte la pression,
   * t_w + debord exterieur + moitie de l espace g, chaque terme borne par c (mm).
   */
  w_s: number;
  /** Debord exterieur de platine charge au-dela de l ame, min(c ; debord) (mm). */
  b_ext: number;
}

function positif(v: number | undefined, nom: string, unite: string): number {
  if (v === undefined || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return v;
}

/** Nombre de cellules par cote de la grille d integration. */
const CELLULES = 800;

/**
 * Aire de l union des zones rigides elargies de c, bornee a la platine et
 * privee du percage (mm2).
 *
 * Zones rigides : le disque de la couronne (diametre D) et, si `avecAmes`,
 * l empreinte de chaque ame (t_w x L_w). L union d un disque et de deux
 * rectangles decoupes par un troisieme n a pas d expression simple : elle
 * est integree sur une grille de 800 x 800 cellules, dont l erreur relative
 * reste sous le millieme pour les proportions courantes. La DEFINITION
 * geometrique est implementee, pas une formule de cas particulier.
 */
export function aireEffective(assemblage: Assemblage, c: number, avecAmes: boolean): number {
  const { platine, plats, ancrage } = assemblage;
  const b = platine.b;
  const h = platine.h;
  const ex = ancrage.excentrement ?? 0;
  const R = ancrage.D / 2 + c;
  const r0 = platine.d_0 / 2;
  const yMinAme = plats.e / 2 - plats.t_w / 2 - c;
  const yMaxAme = plats.e / 2 + plats.t_w / 2 + c;
  const xMaxAme = plats.L_w / 2 + c;

  const dx = h / CELLULES;
  const dy = b / CELLULES;
  let n = 0;
  for (let i = 0; i < CELLULES; i++) {
    const x = -h / 2 + (i + 0.5) * dx;
    for (let j = 0; j < CELLULES; j++) {
      const y = -b / 2 + (j + 0.5) * dy;
      const dyc = y - ex;
      const r2 = x * x + dyc * dyc;
      if (r2 < r0 * r0) continue;
      const dansCouronne = r2 <= R * R;
      const dansAme =
        avecAmes && Math.abs(x) <= xMaxAme && Math.abs(y) >= yMinAme && Math.abs(y) <= yMaxAme;
      if (dansCouronne || dansAme) n++;
    }
  }
  return n * dx * dy;
}

/**
 * Longueur, perpendiculairement aux ames, de l appui d une extremite de
 * platine en appui aux extremites : union des deux bandes t_w + 2c centrees
 * sur les ames, bornee par la largeur de la platine (mm).
 */
export function largeurDAppuiExtremite(b: number, e: number, t_w: number, c: number): number {
  const demi = t_w / 2 + c;
  const bandes: Array<[number, number]> = [
    [Math.max(-b / 2, -e / 2 - demi), Math.min(b / 2, -e / 2 + demi)],
    [Math.max(-b / 2, e / 2 - demi), Math.min(b / 2, e / 2 + demi)],
  ];
  const [[a0, a1], [b0, b1]] = bandes;
  if (a1 >= b0) {
    return b1 - a0;
  }
  return a1 - a0 + (b1 - b0);
}

/**
 * Appui de la platine sur le beton par la methode du troncon en te
 * equivalent comprime, EN 1993-1-8 §6.2.5.
 *
 * APPUI CONTINU. Le contour rigide est l empreinte de la couronne, elargie
 * de c. Les ames n y entrent que si la platine peut leur amener la charge :
 * elles ne sont pas chargees directement — le bloc appuie ENTRE elles —, et
 * c est la platine qui la leur transmet a travers l espace g qui les separe
 * de la couronne. Si g <= c, cette bande est deja comprise dans la zone
 * efficace de la couronne, la transmission est acquise, et l empreinte de
 * chaque ame, elargie de c, s ajoute au contour. Si g > c, les ames ne sont
 * pas comptees : les y compter supposerait une rigidite de platine que la
 * methode ne justifie pas.
 *
 * APPUI AUX EXTREMITES. Chaque extremite porte la moitie de l effort sur la
 * longueur d appui l_appui, sous les bandes t_w + 2c centrees sur les ames.
 *
 * Le calcul de c integre la flexion de la platine sur la largeur c : la
 * platine n a pas d autre verification de flexion en appui continu.
 *
 * beta_j = 2/3 suppose un mortier de calage d epaisseur au plus 0,2 fois la
 * plus petite dimension de la platine et de resistance au moins 0,2 f_ck
 * (§6.2.5(7)).
 */
export function verifierTronconEnT(
  assemblage: Assemblage,
  N_Ed: number,
  f_y_platine: number,
  profil: ProfilEC3,
): ResultatTronconEnT {
  const { platine, plats, ancrage, appui, schema } = assemblage;
  const N = positif(N_Ed, 'L effort N_Ed', 'kN');
  const f_ck = positif(appui.f_ck, 'La resistance du beton f_ck', 'MPa');
  const k_j = appui.k_j ?? 1;
  if (!Number.isFinite(k_j) || k_j < 1 || k_j > 3) {
    throw new Error('Le coefficient de concentration k_j doit etre compris dans [1 ; 3] (-).');
  }
  const t = positif(platine.t, 'L epaisseur de platine t', 'mm');
  const f_y = positif(f_y_platine, 'La limite elastique de la platine f_y', 'MPa');

  const f_cd = f_ck / profil.gamma_c;
  const f_jd = profil.beta_j * k_j * f_cd;
  const c = t * Math.sqrt(f_y / (3 * f_jd * profil.gamma_M0));

  const ex = Math.abs(ancrage.excentrement ?? 0);
  const g = plats.e / 2 - ex - plats.t_w / 2 - ancrage.D / 2;
  const debordExterieur = platine.b / 2 - plats.e / 2 - plats.t_w / 2;
  const b_ext = Math.max(0, Math.min(c, debordExterieur));

  if (schema === 'appui-extremites') {
    const l_appui = positif(appui.l_appui, "La longueur d appui l_appui de chaque extremite", 'mm');
    const A_eff = largeurDAppuiExtremite(platine.b, plats.e, plats.t_w, c) * l_appui;
    const N_appui = N / 2;
    const F_c_Rd = (A_eff * f_jd) / 1000;
    return {
      f_cd,
      f_jd,
      c,
      g,
      amesDansLeContour: true,
      motifAmesExclues: null,
      A_eff,
      N_appui,
      F_c_Rd,
      sigma_c: (N_appui * 1000) / A_eff,
      taux: N_appui / F_c_Rd,
      w_s: 0,
      b_ext,
    };
  }

  const amesDansLeContour = g <= c;
  const A_eff = aireEffective(assemblage, c, amesDansLeContour);
  const F_c_Rd = (A_eff * f_jd) / 1000;
  const w_s = plats.t_w + b_ext + Math.max(0, Math.min(c, g / 2));

  return {
    f_cd,
    f_jd,
    c,
    g,
    amesDansLeContour,
    motifAmesExclues: amesDansLeContour
      ? null
      : `l espace g = ${g.toFixed(1)} mm entre la couronne et l ame depasse c = ${c.toFixed(1)} mm : ` +
        'la platine ne justifie pas le report de la charge sur les ames',
    A_eff,
    N_appui: N,
    F_c_Rd,
    sigma_c: (N * 1000) / A_eff,
    taux: N / F_c_Rd,
    w_s: amesDansLeContour ? w_s : 0,
    b_ext,
  };
}
