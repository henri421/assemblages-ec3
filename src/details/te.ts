/**
 * Plat soude perpendiculairement sur une piece de base : te, cruciforme,
 * assemblage d angle.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en MPa.
 *
 * Repere du plan de joint : y a travers l epaisseur du plat attache, z le
 * long du cordon (longueur soudee L), origine au centre de la section du plat.
 *
 * - `te` : plat soude sur la face d une platine.
 * - `cruciforme` : deux plats alignes de part et d autre d un plat traversant.
 *   L effort traverse la piece de base dans son epaisseur ; les deux cotes
 *   etant identiques, un seul est verifie.
 * - `angle` : plat soude au bord d une autre piece, a angle droit. Meme
 *   mecanique que le te, mais le retrait arrache le bord de la piece de base :
 *   c est la configuration la plus sensible a l arrachement lamellaire.
 */

import {
  REGLES_CORDONS,
  type ContexteCordons,
  type Regle,
} from '../dispositions/regles';
import { verifierDispositions, type ResultatDispositions } from '../dispositions/verifier-dispositions';
import { sansObjet, taux, type Taux } from '../domaines/taux-de-travail';
import {
  CONDITIONS_PAR_DEFAUT,
  verifierArrachement,
  type ConditionsSoudage,
  type ResultatArrachement,
} from '../epaisseur/arrachement-lamellaire';
import type { Materiau } from '../model/materiau';
import { limiteElastique, resistanceUltime } from '../norms/acier';
import { betaW } from '../norms/beta-w';
import { ec3Recommande, validerProfil, type ProfilEC3 } from '../norms/ec3-recommande';
import type { CordonGroupe } from '../soudures/groupe';
import { gorgePleineResistance, type ResultatPleineResistance } from '../soudures/pleine-resistance';
import {
  conclure,
  cordon,
  fini,
  metalDeBase,
  positif,
  verifierCordons,
  type Constats,
  type MetalDeBase,
  type ResultatCordons,
  type VerdictDetail,
} from './commun';

export type NatureTe = 'te' | 'cruciforme' | 'angle';
export type SoudureTe = 'angle' | 'penetration-partielle' | 'penetration-totale';

export interface SollicitationsTe {
  /** Effort normal au plan de joint, traction positive (kN). */
  N: number;
  /** Tranchant le long du cordon (kN). */
  V_para: number;
  /** Tranchant a travers l epaisseur du plat (kN). */
  V_perp: number;
  /** Moment dans le plan du plat : la contrainte varie le long du cordon (kN.m). */
  M_plan: number;
  /** Moment autour de l axe du cordon : il oppose les deux cordons (kN.m). */
  M_hors: number;
}

export interface DonneesTe {
  nature: NatureTe;
  /** Epaisseur du plat attache (mm). */
  t_p: number;
  /** Longueur soudee (mm). */
  L: number;
  /** Epaisseur de la piece de base (mm). */
  t_b: number;
  soudure: {
    type: SoudureTe;
    /** Gorge du cordon d angle, ou profondeur de penetration (mm). */
    a: number;
    /** Un ou deux cordons. */
    cotes: 1 | 2;
  };
  sollicitations: SollicitationsTe;
  materiau: Materiau;
  profil?: ProfilEC3;
  conditionsSoudage?: ConditionsSoudage;
}

export interface ResultatTe {
  detail: NatureTe;
  verdict: VerdictDetail;
  motif: string;
  constats: Constats;
  f_y_plat: number;
  f_u: number;
  beta_w: number;
  /** null pour une soudure a pleine penetration, qui ne se calcule pas. */
  cordons: ResultatCordons | null;
  metal: MetalDeBase;
  pleineResistance: ResultatPleineResistance | null;
  arrachement: ResultatArrachement;
  dispositions: ResultatDispositions;
  taux: Taux[];
  mecanismeGouvernant: string;
}

interface ContexteTe extends ContexteCordons {
  donnees: DonneesTe;
}

const REGLES_TE: readonly Regle<ContexteTe>[] = [
  ...REGLES_CORDONS,
  {
    id: 'cordon-unique',
    clause: 'EN 1993-1-8 §4.12',
    severite: 'information',
    enonce: 'soudure d un seul cote : pas de traction ni de moment autour de son axe',
    applicabilite: ({ donnees }) =>
      donnees.soudure.cotes === 1 && donnees.soudure.type !== 'penetration-totale'
        ? null
        : 'soudure des deux cotes ou pleine penetration',
    evaluer: () =>
      'une soudure d un seul cote ne reprend que du cisaillement et un moment dans le plan du plat ; ' +
      'l excentricite locale d une traction est a eviter (§4.12)',
  },
  {
    id: 'penetration-partielle',
    clause: 'EN 1993-1-8 §4.7.2(2)',
    severite: 'information',
    enonce: 'gorge au plus egale a la penetration obtenue avec regularite',
    applicabilite: ({ donnees }) =>
      donnees.soudure.type === 'penetration-partielle' ? null : 'pas de penetration partielle',
    evaluer: () =>
      'la gorge retenue ne depasse pas la penetration obtenue avec regularite, attestee par la ' +
      'qualification du mode operatoire',
  },
  {
    id: 'penetration-totale',
    clause: 'EN 1993-1-8 §4.7.1(1)',
    severite: 'information',
    enonce: 'pleine penetration : resistance de la piece la plus faible',
    applicabilite: ({ donnees }) =>
      donnees.soudure.type === 'penetration-totale' ? null : 'pas de pleine penetration',
    evaluer: () =>
      'une soudure a pleine penetration a la resistance de la plus faible des pieces assemblees, ' +
      'sous reserve d un metal d apport au moins aussi resistant',
  },
];

/**
 * Verification d un plat soude perpendiculairement sur une piece de base.
 *
 * Gorges rabattues sur le plan de joint : un cordon d angle a cote du plat,
 * a y = +-(t_p + a)/2, de sorte que le bras de levier entre deux cordons vaut
 * t_p + a ; une penetration partielle dans l epaisseur du plat, a
 * y = +-(t_p - a)/2.
 *
 * Un cordon unique n a pas d inertie autour de son axe : la traction du plat,
 * excentree de (t_p + a)/2, et un moment M_hors ne peuvent y etre repris. Le
 * calcul le refuse plutot que de les ignorer (§4.12). Avec un cordon unique,
 * les tranchants sont appliques au centre du cordon, pas a celui du plat.
 *
 * Pleine penetration : pas de calcul de gorge (§4.7.1) ; seul le metal de
 * base est verifie.
 */
export function verifierTe(d: DonneesTe): ResultatTe {
  const profil = validerProfil(d.profil ?? ec3Recommande());
  const t_p = positif(d.t_p, 'L epaisseur du plat t_p', 'mm');
  const L = positif(d.L, 'La longueur soudee L', 'mm');
  const t_b = positif(d.t_b, 'L epaisseur de la piece de base t_b', 'mm');
  const a = positif(d.soudure.a, 'La gorge a', 'mm');
  const s = {
    N: fini(d.sollicitations.N, 'L effort N', 'kN'),
    V_para: fini(d.sollicitations.V_para, 'Le tranchant V_para', 'kN'),
    V_perp: fini(d.sollicitations.V_perp, 'Le tranchant V_perp', 'kN'),
    M_plan: fini(d.sollicitations.M_plan, 'Le moment M_plan', 'kN.m'),
    M_hors: fini(d.sollicitations.M_hors, 'Le moment M_hors', 'kN.m'),
  };
  const { type, cotes } = d.soudure;
  if (type === 'penetration-partielle' && cotes * a >= t_p) {
    throw new Error(
      'La penetration partielle a doit rester inferieure a t_p (un cote) ou t_p / 2 (deux cotes) (mm).',
    );
  }

  const f_y_plat = limiteElastique(d.materiau.nuance, t_p);
  const f_u = Math.min(resistanceUltime(d.materiau.nuance, t_p), resistanceUltime(d.materiau.nuance, t_b));
  const beta_w = betaW(d.materiau.nuance);

  if (type !== 'penetration-totale' && cotes === 1 && (s.N !== 0 || s.M_hors !== 0)) {
    throw new Error(
      'Une soudure d un seul cote ne reprend ni effort normal ni moment M_hors autour de son axe ' +
        '(EN 1993-1-8 §4.12) : souder des deux cotes, ou en pleine penetration.',
    );
  }

  let cordons: ResultatCordons | null = null;
  if (type !== 'penetration-totale') {
    const y = type === 'angle' ? (t_p + a) / 2 : (t_p - a) / 2;
    const typeCordon = type === 'angle' ? 'angle' : 'penetration-partielle';
    const groupe: CordonGroupe[] = [cordon('cote-1', y, -L / 2, y, L / 2, a, [1, 0], { type: typeCordon })];
    if (cotes === 2) {
      groupe.push(cordon('cote-2', -y, -L / 2, -y, L / 2, a, [-1, 0], { type: typeCordon }));
    }
    // Sollicitations donnees au centre de la section du plat, qui est aussi
    // le centre du groupe a deux cordons ; a un cordon, N et M_hors sont nuls.
    cordons = verifierCordons(
      groupe,
      { N: s.N, V_y: s.V_perp, V_z: s.V_para, M_y: s.M_plan, M_z: s.M_hors },
      () => ({ f_u, beta_w, gamma_M2: profil.gamma_M2 }),
    );
  }

  const metal = metalDeBase(
    t_p,
    L,
    { N: s.N, V_1: s.V_para, V_2: s.V_perp, M_L: s.M_plan, M_t: s.M_hors },
    f_y_plat,
    profil.gamma_M0,
  );

  const pleineResistance =
    type === 'angle' && cotes === 2
      ? gorgePleineResistance({ t_w: t_p, f_y: f_y_plat, f_u, beta_w, gamma_M0: profil.gamma_M0, gamma_M2: profil.gamma_M2 })
      : null;

  const formeParDefaut =
    d.nature === 'angle' ? 'assemblage-angle' : type === 'angle' ? 'angle-multipasse' : 'penetration';
  const arrachement = verifierArrachement({
    t: t_b,
    a,
    cordonDAngle: type === 'angle',
    conditions: d.conditionsSoudage ?? { ...CONDITIONS_PAR_DEFAUT, forme: formeParDefaut },
    qualite: d.materiau.qualiteZ,
  });

  const ctx: ContexteTe = {
    donnees: d,
    cordons:
      type === 'penetration-totale'
        ? []
        : [{ id: 'plat', a, l: L, t_min: Math.min(t_p, t_b), type: type === 'angle' ? 'angle' : 'penetration-partielle' }],
    epaisseurs: [t_p, t_b],
  };
  const dispositions = verifierDispositions(REGLES_TE, ctx);

  const liste: Taux[] = [
    cordons === null
      ? sansObjet('soudure', 'EN 1993-1-8 §4.7.1', 'soudure', 'pleine penetration : resistance de la piece la plus faible')
      : taux(
          'soudure',
          type === 'angle' ? 'EN 1993-1-8 §4.5.3.2' : 'EN 1993-1-8 §4.7.2',
          `${type === 'angle' ? 'cordons d angle' : 'penetration partielle'}, ${cordons.gouvernant.cordon}`,
          cordons.taux,
        ),
    taux('metal-de-base', 'EN 1993-1-1 §6.2.1(5)', 'plat attache au droit de la soudure', metal.taux),
    taux(
      'arrachement-lamellaire',
      'EN 1993-1-10 §3.2',
      `arrachement lamellaire de la piece de base, Z_Ed = ${arrachement.Z_Ed}`,
      arrachement.taux,
    ),
  ];
  const fin = conclure(liste, dispositions);

  return {
    detail: d.nature,
    ...fin,
    f_y_plat,
    f_u,
    beta_w,
    cordons,
    metal,
    pleineResistance,
    arrachement,
    dispositions,
  };
}
