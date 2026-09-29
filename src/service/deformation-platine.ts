/**
 * Critere de service : deformation de la platine au blocage — CFMS, Tirants
 * d ancrage TA 2020.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 *
 * Le TA 2020 exige que la plaque d appui soit dimensionnee de sorte que ses
 * deformations lors du transfert de la charge du verin a la tete d ancrage
 * soient NEGLIGEABLES : elles s ajoutent aux pertes liees au blocage. C est un
 * verdict DISTINCT du verdict de resistance, qui peut gouverner devant lui.
 *
 * Le TA 2020 ne chiffre pas « negligeable ». L outil constate deux choses :
 * - que la piece reste ELASTIQUE sous la traction de blocage — une
 *   deformation permanente n est jamais negligeable ;
 * - la fleche, comparee a une limite que l ingenieur fixe s il le souhaite.
 */

export type DonneesService =
  | {
      schema: 'appui-continu';
      P_blocage: number;
      /** Aire d appui efficace du troncon en te (mm2). */
      A_eff: number;
      /** Debord efficace c (mm). */
      c: number;
      t: number;
      f_y: number;
      E: number;
      /** Fleche admise (mm), facultative. */
      delta_lim?: number;
    }
  | {
      schema: 'appui-extremites';
      P_blocage: number;
      part: number;
      /** Portee (mm). */
      L: number;
      /** Inertie de la poutre en te d une ame (mm4). */
      I: number;
      /** Distance maximale de l axe neutre a une fibre de la poutre en te (mm). */
      v_max: number;
      /** Limite elastique la plus faible des pieces de la poutre (MPa). */
      f_y_poutre: number;
      e: number;
      /** Largeur utile de platine entre les ames (mm). */
      w: number;
      d_0: number;
      t: number;
      f_y: number;
      E: number;
      delta_lim?: number;
    };

export interface ResultatService {
  P_blocage: number;
  /** Fleche locale de la platine (mm). */
  delta_platine: number;
  /** Fleche de la poutre de portee L (mm), nulle en appui continu. */
  delta_poutre: number;
  /** Fleche totale (mm). */
  delta: number;
  delta_lim: number | null;
  /** delta / delta_lim, null sans limite (-). */
  tauxDeformation: number | null;
  /** Plus grande contrainte elastique rapportee a f_y (-). */
  tauxElastique: number;
  /** Elastique, et sous la limite de fleche si elle est donnee. */
  conforme: boolean;
}

function positif(v: number, nom: string, unite: string): number {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return v;
}

/**
 * Deformation et elasticite de la platine sous la traction de blocage.
 *
 * APPUI CONTINU. Le debord c de la platine au-dela du contour rigide est une
 * console chargee par la pression sigma = P / A_eff :
 *   fleche  1,5 sigma c^4 / (E t^3),   contrainte  3 sigma c^2 / t^2.
 * Remarque : la largeur c de l EN 1993-1-8 est celle ou, sous f_jd, cette
 * contrainte atteint EXACTEMENT f_y / gamma_M0. La platine est donc
 * elastique au blocage des que l appui l est a l ELU.
 *
 * APPUI AUX EXTREMITES. Poutre sur deux appuis, charge a mi-portee :
 *   fleche  part P L^3 / (48 E I),  contrainte  part P L v / (4 I) ;
 * plus la flexion de la platine entre les ames, sur appuis simples (borne
 * haute) : fleche P e^3 / (48 E w t^3 / 12), contrainte P e / ((w - d_0) t^2),
 * soit le moment de predimensionnement P e / 6 sur la section nette.
 */
export function verifierService(d: DonneesService): ResultatService {
  const P = positif(d.P_blocage, 'La traction de blocage P_blocage', 'kN') * 1000; // N
  const t = positif(d.t, 'L epaisseur de platine t', 'mm');
  const f_y = positif(d.f_y, 'La limite elastique f_y', 'MPa');
  const E = positif(d.E, 'Le module d elasticite E', 'MPa');
  const delta_lim = d.delta_lim === undefined ? null : positif(d.delta_lim, 'La fleche admise', 'mm');

  let delta_platine: number;
  let delta_poutre = 0;
  let tauxElastique: number;

  if (d.schema === 'appui-continu') {
    const sigma = P / positif(d.A_eff, 'L aire efficace A_eff', 'mm2');
    const c = positif(d.c, 'La largeur c', 'mm');
    delta_platine = (1.5 * sigma * c ** 4) / (E * t ** 3);
    tauxElastique = (3 * sigma * c ** 2) / (t ** 2 * f_y);
  } else {
    const L = positif(d.L, 'La portee L', 'mm');
    const I = positif(d.I, 'L inertie I', 'mm4');
    const e = positif(d.e, 'L entraxe e', 'mm');
    const w = positif(d.w, 'La largeur utile w', 'mm');
    const Pw = d.part * P;
    delta_poutre = (Pw * L ** 3) / (48 * E * I);
    const sigmaPoutre = (Pw * L * d.v_max) / (4 * I);
    delta_platine = (P * e ** 3) / (48 * E * ((w * t ** 3) / 12));
    const sigmaPlatine = (P * e) / ((w - d.d_0) * t ** 2);
    tauxElastique = Math.max(sigmaPoutre / positif(d.f_y_poutre, 'La limite elastique de la poutre', 'MPa'), sigmaPlatine / f_y);
  }

  const delta = delta_platine + delta_poutre;
  const tauxDeformation = delta_lim === null ? null : delta / delta_lim;
  return {
    P_blocage: P / 1000,
    delta_platine,
    delta_poutre,
    delta,
    delta_lim,
    tauxDeformation,
    tauxElastique,
    conforme: tauxElastique <= 1 && (tauxDeformation === null || tauxDeformation <= 1),
  };
}
