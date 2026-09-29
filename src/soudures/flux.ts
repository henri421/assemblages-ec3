/**
 * Decomposition des sollicitations d une tete d ancrage par cordon.
 *
 * Unites : efforts en kN, efforts lineiques en kN/mm, longueurs en mm,
 * moments en kN.m.
 *
 * Chaque ame porte deux cordons d angle, un de chaque cote. On nomme
 * `interieur` le cordon tourne vers le tirant, `exterieur` celui tourne vers
 * le bord de la platine. Seule l ame la plus chargee est examinee : l autre
 * l est moins, par construction.
 *
 * Modele de transmission (voir docs/validation/vasse.md). La couronne pousse
 * la platine vers le support, entre les ames. On retient le modele de la
 * platine PORTEE PAR LES AMES : la platine franchit l entraxe e et se
 * suspend aux deux ames, qui reportent la charge sur leur longueur (poutres en
 * te sur le beton) ou jusqu aux appuis (poutre sur lierne). En appui continu,
 * c est une borne : le beton situe sous la couronne en porte directement une
 * partie, que ce modele ignore.
 */

import type { Assemblage } from '../model/assemblage';
import type { EffortsLineiques } from './gorge';

export interface ProprietesAme {
  /** Moment statique de la platine participante d une ame / axe neutre (mm3). */
  S_f: number;
  /** Inertie de la section en te d une ame et de sa platine participante (mm4). */
  I: number;
}

export interface DonneesFlux {
  assemblage: Assemblage;
  /** Effort de dimensionnement (kN). */
  N_Ed: number;
  /** Composante tangentielle dans le plan de la platine (kN) ; 0 par defaut. */
  H_Ed?: number;
  /** Limite elastique de la platine (MPa). */
  f_y_platine: number;
  /** Limite elastique des ames (MPa). */
  f_y_ame: number;
  /** Proprietes de la section en te d une ame. */
  ame: ProprietesAme;
}

/** Borne qui fixe le moment local transmis au cordon. */
export type BorneMomentLocal = 'encastrement' | 'platine' | 'ame';

export interface CasCordon {
  id: string;
  /** Cordon concerne. */
  cordon: 'interieur' | 'exterieur';
  /** Description en clair du cas examine. */
  libelle: string;
  efforts: EffortsLineiques;
}

export interface FluxSoudures {
  /** Longueur efficace d un cordon (mm). */
  l_eff: number;
  /** Longueur sur laquelle la couronne charge les ames, min(l_eff ; D + 2t) (mm). */
  l_charge: number;
  /** Part de N_Ed reprise par l ame la plus chargee (-). */
  part: number;
  /** Distance de l axe du tirant a l ame la plus chargee (mm). */
  x_charge: number;
  /** Suspension de la platine a l ame, part * N_Ed / l_charge (kN/mm). */
  F_Ed: number;
  /** Moment d encastrement parfait de la platine sur l ame la plus chargee (kN.m). */
  M_encastrement: number;
  /** Le meme, par unite de longueur chargee (kN.mm/mm = kN). */
  m_encastrement: number;
  /** Moment plastique lineique de la platine, t^2 f_y / 4 (kN). */
  m_pl_platine: number;
  /** Moment plastique lineique de l ame, t_w^2 f_y / 4 (kN). */
  m_pl_ame: number;
  /** Moment local retenu, le plus petit des trois (kN). */
  m_Ed: number;
  /** Ce qui le fixe. */
  borne: BorneMomentLocal;
  /** Bras de levier entre les deux cordons d une ame, t_w + a (mm). */
  bras: number;
  /** Couple du moment local sur les cordons, m_Ed / (t_w + a) (kN/mm). */
  delta_F: number;
  /** Effort tranchant de la poutre en te de l ame la plus chargee (kN). */
  V_Ed: number;
  /** Flux longitudinal par ame, V_Ed S_f / I (kN/mm). */
  v_Ed: number;
  /** Appui aux extremites : longueur d appui (mm), null en appui continu. */
  l_appui: number | null;
  /** Flux tangentiel par cordon, H_Ed / (4 l_eff) (kN/mm). */
  h_Ed: number;
  cas: CasCordon[];
}

function positif(v: number | undefined, nom: string, unite: string): number {
  if (v === undefined || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return v;
}

/**
 * Longueur de cordon chargee par la couronne, min(l_eff ; D + 2t).
 *
 * La couronne de diametre D se diffuse a 45 degres dans l epaisseur de la
 * platine : au droit des cordons, elle occupe D + 2t. Repartir l effort sur
 * toute la longueur du cordon, comme le ferait un flux N / (2 l_eff), le
 * supposerait uniforme sur des ames eventuellement bien plus longues que la
 * couronne : c est non conservatif des que L_w depasse D + 2t.
 */
export function longueurChargee(l_eff: number, D: number, t: number): number {
  return Math.min(l_eff, D + 2 * t);
}

/**
 * Moment d encastrement de la platine sur l ame la plus proche d une charge
 * concentree P placee a x de cette ame, entre deux ames d entraxe e :
 *   M = P x (e - x)^2 / e^2   (poutre bi-encastree).
 *
 * C est la borne haute du moment local sur l ame : un encastrement parfait.
 * Charge centree, il vaut P e / 8. La platine n est en realite qu en partie
 * encastree, mais le cordon est l element fragile de la liaison : on lui
 * applique la borne defavorable.
 */
export function momentDEncastrement(P: number, x: number, e: number): number {
  return (P * x * (e - x) ** 2) / e ** 2;
}

/**
 * Longueur d appui de chaque extremite en appui aux extremites (mm).
 *
 * Sur lierne, la largeur de la semelle chargee en tient lieu si la longueur
 * d appui n est pas donnee : c est sur elle que la platine repose.
 */
export function longueurDAppui(assemblage: Assemblage): number {
  const { appui } = assemblage;
  const l = appui.l_appui ?? (appui.type === 'lierne-acier' ? appui.b_f_lierne : undefined);
  return positif(l, "La longueur d appui l_appui de chaque extremite", 'mm');
}

/**
 * Efforts lineiques sur les deux cordons de l ame la plus chargee.
 *
 * Contributions superposees :
 *
 * 1. Suspension de la platine : la couronne pousse la platine vers le support,
 *    les ames la retiennent. F_Ed = part * N_Ed / l_charge par ame, la moitie
 *    par cordon, en TRACTION de la gorge (p_1 > 0). Le contact direct n y
 *    change rien : un contact ne transmet pas de traction.
 *
 * 2. Moment local d encastrement de la platine sur l ame :
 *    delta_F = m_Ed / (t_w + a). La platine flechit entre les ames, en
 *    s eloignant d elles : elle arrache le cordon INTERIEUR et comprime
 *    l exterieur. m_Ed est le plus petit de l encastrement parfait et des
 *    moments plastiques lineiques de la platine et de l ame — le noeud ne
 *    transmet pas plus que ce que la plus faible des deux pieces developpe.
 *    Ces moments plastiques sont pris SANS coefficient partiel : ce sont des
 *    bornes de l action reelle, pas des resistances de calcul.
 *    CE TERME N EST JAMAIS OMIS, MEME AVEC `contactDirect` : c est lui qui
 *    met la racine du cordon en traction, cause la plus frequente de
 *    fissuration en pied de cordon sur ce type de piece. Le contact direct ne
 *    retire que la part COMPRIMEE du couple sur le cordon exterieur.
 *
 * 3. Flux longitudinal de la poutre en te : v_Ed = V_Ed S_f / I par ame, la
 *    moitie par cordon. En appui continu, V_Ed est l effort tranchant de la
 *    poutre en te qui repartit la charge sur L_w sous une pression uniforme ;
 *    en appui aux extremites, la reaction d appui part * N_Ed / 2.
 *
 * 4. Appui aux extremites seulement : au droit de l appui, la reaction
 *    comprime la platine contre le chant de l ame, sur la longueur d appui.
 *    Retire de la gorge avec `contactDirect`.
 *
 * Si une composante tangentielle H_Ed existe (inclinaison > 3 degres), elle
 * est repartie sur les quatre cordons et examinee dans les trois directions
 * possibles, faute de connaitre l azimut de l inclinaison.
 */
export function fluxDansLesCordons(d: DonneesFlux): FluxSoudures {
  const { platine, plats, soudure, ancrage, schema } = d.assemblage;
  const N_Ed = positif(d.N_Ed, 'L effort N_Ed', 'kN');
  const e = positif(plats.e, 'L entraxe des ames e', 'mm');
  const t_w = positif(plats.t_w, 'L epaisseur d ame t_w', 'mm');
  const a = positif(soudure.a, 'La gorge a', 'mm');
  const t = positif(platine.t, 'L epaisseur de platine t', 'mm');
  const D = positif(ancrage.D, 'Le diametre de couronne D', 'mm');
  const L_w = positif(plats.L_w, 'La longueur d ame L_w', 'mm');
  const l_eff = positif(soudure.l_eff ?? L_w, 'La longueur efficace du cordon l_eff', 'mm');
  const f_y_platine = positif(d.f_y_platine, 'La limite elastique de la platine f_y', 'MPa');
  const f_y_ame = positif(d.f_y_ame, 'La limite elastique des ames f_y', 'MPa');
  const S_f = positif(d.ame.S_f, 'Le moment statique S_f', 'mm3');
  const I = positif(d.ame.I, 'L inertie I', 'mm4');
  const H_Ed = d.H_Ed ?? 0;
  if (!Number.isFinite(H_Ed) || H_Ed < 0) {
    throw new Error('La composante tangentielle H_Ed doit etre un nombre positif ou nul (kN).');
  }
  const ex = ancrage.excentrement ?? 0;
  if (!Number.isFinite(ex) || Math.abs(ex) >= e / 2) {
    throw new Error(
      "L excentrement du tirant doit etre un nombre fini, inferieur en valeur absolue a e/2 (mm).",
    );
  }

  const l_charge = longueurChargee(l_eff, D, t);
  const part = 0.5 + Math.abs(ex) / e;
  const x_charge = e / 2 - Math.abs(ex);
  const F_Ed = (part * N_Ed) / l_charge;

  // kN * mm ; par unite de longueur : kN.mm / mm = kN.
  const M_kNmm = momentDEncastrement(N_Ed, x_charge, e);
  const m_encastrement = M_kNmm / l_charge;
  // N.mm/mm -> kN : division par 1000.
  const m_pl_platine = (t ** 2 * f_y_platine) / 4 / 1000;
  const m_pl_ame = (t_w ** 2 * f_y_ame) / 4 / 1000;
  let m_Ed = m_encastrement;
  let borne: BorneMomentLocal = 'encastrement';
  if (m_pl_platine < m_Ed) {
    m_Ed = m_pl_platine;
    borne = 'platine';
  }
  if (m_pl_ame < m_Ed) {
    m_Ed = m_pl_ame;
    borne = 'ame';
  }
  const bras = t_w + a;
  const delta_F = m_Ed / bras;

  let V_Ed: number;
  let l_appui: number | null = null;
  if (schema === 'appui-extremites') {
    V_Ed = (part * N_Ed) / 2;
    l_appui = longueurDAppui(d.assemblage);
  } else {
    // Poutre en te sous charge centrale part*N sur l_charge, equilibree par
    // une pression uniforme sur L_w : tranchant maximal au bord de la zone
    // chargee.
    V_Ed = (part * N_Ed * (L_w - Math.min(l_charge, L_w))) / (2 * L_w);
  }
  const v_Ed = (V_Ed * S_f) / I;

  const h_Ed = H_Ed / (4 * l_eff);
  const contact = soudure.contactDirect;
  const sansCompressionSiContact = (p: number): number => (contact && p < 0 ? 0 : p);

  const base: Array<{ cordon: 'interieur' | 'exterieur'; id: string; libelle: string; efforts: EffortsLineiques }> = [
    {
      cordon: 'interieur',
      id: 'interieur',
      libelle: 'cordon interieur, zone chargee',
      efforts: { p_1: F_Ed / 2 + delta_F, p_2: 0, p_para: v_Ed / 2 },
    },
    {
      cordon: 'exterieur',
      id: 'exterieur',
      libelle: 'cordon exterieur, zone chargee',
      efforts: { p_1: sansCompressionSiContact(F_Ed / 2 - delta_F), p_2: 0, p_para: v_Ed / 2 },
    },
  ];
  if (l_appui !== null) {
    const p_appui = sansCompressionSiContact(-V_Ed / (2 * l_appui));
    for (const cordon of ['interieur', 'exterieur'] as const) {
      base.push({
        cordon,
        id: `${cordon}-appui`,
        libelle: `cordon ${cordon}, au droit de l appui`,
        efforts: { p_1: p_appui, p_2: 0, p_para: v_Ed / 2 },
      });
    }
  }

  const cas: CasCordon[] = [];
  for (const b of base) {
    if (h_Ed === 0) {
      cas.push(b);
      continue;
    }
    cas.push(
      {
        ...b,
        id: `${b.id}-H-long`,
        libelle: `${b.libelle}, H le long des ames`,
        efforts: { ...b.efforts, p_para: b.efforts.p_para + h_Ed },
      },
      {
        ...b,
        id: `${b.id}-H-vers`,
        libelle: `${b.libelle}, H pousse l ame vers le cordon`,
        efforts: { ...b.efforts, p_2: h_Ed },
      },
      {
        ...b,
        id: `${b.id}-H-hors`,
        libelle: `${b.libelle}, H tire l ame hors du cordon`,
        efforts: { ...b.efforts, p_2: -h_Ed },
      },
    );
  }

  return {
    l_eff,
    l_charge,
    part,
    x_charge,
    F_Ed,
    M_encastrement: M_kNmm / 1000,
    m_encastrement,
    m_pl_platine,
    m_pl_ame,
    m_Ed,
    borne,
    bras,
    delta_F,
    V_Ed,
    v_Ed,
    l_appui,
    h_Ed,
    cas,
  };
}
