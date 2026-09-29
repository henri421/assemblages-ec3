/**
 * Decomposition des sollicitations d une tete d ancrage par cordon.
 *
 * Unites : efforts en kN, efforts lineiques en kN/mm, longueurs en mm,
 * moments en kN.m.
 *
 * Chaque ame porte deux cordons d angle, un de chaque cote. On nomme
 * `exterieur` le cordon tourne vers le bord de la platine, `interieur` celui
 * tourne vers le percage. Seule l ame la plus chargee est examinee : l autre
 * l est moins, par construction.
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
  /** Requis si le schema est `appui-extremites`. */
  ame?: ProprietesAme;
}

/** Borne qui fixe le moment local transmis au cordon. */
export type BorneMomentLocal = 'encastrement' | 'platine' | 'ame';

export interface CasCordon {
  id: string;
  /** Cordon concerne. */
  cordon: 'exterieur' | 'interieur';
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
  /** Flux transversal par ame, part * N_Ed / l_charge (kN/mm). */
  F_Ed: number;
  /** Faux si le contact direct court-circuite la gorge en compression. */
  compressionDansLaGorge: boolean;
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
  /** Traction du moment local sur le cordon exterieur, m_Ed / (t_w + a) (kN/mm). */
  delta_F: number;
  /** Effort tranchant de l ame la plus chargee (kN), nul en appui continu. */
  V_Ed: number;
  /** Flux longitudinal par ame, V_Ed S_f / I (kN/mm), nul en appui continu. */
  v_Ed: number;
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
 * platine : au droit des cordons, sur la face opposee, elle occupe D + 2t.
 * Repartir l effort sur toute la longueur du cordon, comme le ferait un flux
 * N / (2 l_eff), le supposerait uniforme sur des ames eventuellement bien plus
 * longues que la couronne : c est non conservatif des que L_w depasse D + 2t.
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
 * Efforts lineiques sur les deux cordons de l ame la plus chargee.
 *
 * Trois contributions, superposees :
 *
 * 1. Flux transversal, compression de la platine sur l ame :
 *    F_Ed = part * N_Ed / l_charge par ame, la moitie par cordon, en
 *    compression de la gorge (p_1 < 0). Si `contactDirect`, la compression
 *    transite par contact et ce terme est retire de la gorge.
 *
 * 2. Moment local d encastrement de la platine sur l ame :
 *    delta_F = m_Ed / (t_w + a), traction sur le cordon exterieur, compression
 *    sur l interieur. La platine flechit entre les ames et se souleve au-dela :
 *    c est le cordon exterieur qu elle arrache.
 *    m_Ed est le plus petit de l encastrement parfait et des moments
 *    plastiques lineiques de la platine et de l ame. Le noeud ne peut pas
 *    transmettre plus que ce que la plus faible des deux pieces developpe :
 *    au-dela, elle plastifie et le moment se reporte en travee, ou la
 *    verification de la platine le retrouve (borne en appuis simples N e / 4).
 *    Ces moments plastiques sont pris SANS coefficient partiel : ce sont des
 *    bornes de ce que la piece transmet reellement, pas des resistances de
 *    calcul — les diviser par gamma_M0 minorerait l action sur le cordon.
 *    Avec `contactDirect`, la moitie comprimee du couple passe elle aussi par
 *    contact ; la moitie tendue, non.
 *    CE TERME N EST JAMAIS OMIS, MEME AVEC `contactDirect` : c est precisement
 *    lui qui remet de la traction dans la gorge sous un effort global de
 *    compression, et la cause la plus frequente de fissuration en pied de
 *    cordon sur ce type de piece.
 *
 * 3. Appui aux extremites seulement, flux longitudinal de la section composee :
 *    v_Ed = V_Ed S_f / I par ame, la moitie par cordon.
 *
 * Si une composante tangentielle H_Ed existe (inclinaison > 3 degres), elle
 * est repartie sur les quatre cordons et examinee dans les trois directions
 * possibles — le long des ames, et a travers elles dans les deux sens — faute
 * de connaitre l azimut de l inclinaison.
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
  const compressionDansLaGorge = !soudure.contactDirect;

  const f_y_platine = positif(d.f_y_platine, 'La limite elastique de la platine f_y', 'MPa');
  const f_y_ame = positif(d.f_y_ame, 'La limite elastique des ames f_y', 'MPa');

  // kN * mm -> kN.m ; par unite de longueur : kN.mm / mm = kN.
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

  let V_Ed = 0;
  let v_Ed = 0;
  if (schema === 'appui-extremites') {
    if (d.ame === undefined) {
      throw new Error("Les proprietes de la section composee sont requises en appui aux extremites.");
    }
    const S_f = positif(d.ame.S_f, 'Le moment statique S_f', 'mm3');
    const I = positif(d.ame.I, 'L inertie I', 'mm4');
    V_Ed = (part * N_Ed) / 2;
    v_Ed = (V_Ed * S_f) / I;
  }

  const h_Ed = H_Ed / (4 * l_eff);
  const compression = compressionDansLaGorge ? -F_Ed / 2 : 0;

  const base: Record<'exterieur' | 'interieur', EffortsLineiques> = {
    exterieur: { p_1: compression + delta_F, p_2: 0, p_para: v_Ed / 2 },
    interieur: {
      p_1: compression - (compressionDansLaGorge ? delta_F : 0),
      p_2: 0,
      p_para: v_Ed / 2,
    },
  };

  const cas: CasCordon[] = [];
  for (const cordon of ['exterieur', 'interieur'] as const) {
    const b = base[cordon];
    if (h_Ed === 0) {
      cas.push({ id: cordon, cordon, libelle: `cordon ${cordon}`, efforts: b });
      continue;
    }
    cas.push(
      {
        id: `${cordon}-H-long`,
        cordon,
        libelle: `cordon ${cordon}, H le long des ames`,
        efforts: { ...b, p_para: b.p_para + h_Ed },
      },
      {
        id: `${cordon}-H-vers`,
        cordon,
        libelle: `cordon ${cordon}, H pousse l ame vers le cordon`,
        efforts: { ...b, p_2: h_Ed },
      },
      {
        id: `${cordon}-H-hors`,
        cordon,
        libelle: `cordon ${cordon}, H tire l ame hors du cordon`,
        efforts: { ...b, p_2: -h_Ed },
      },
    );
  }

  return {
    l_eff,
    l_charge,
    part,
    x_charge,
    F_Ed,
    compressionDansLaGorge,
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
    h_Ed,
    cas,
  };
}
