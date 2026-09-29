/**
 * Assemblage a recouvrement : un plat attache pose sur un plat de base,
 * cordons lateraux et frontal — EN 1993-1-8:2005 §4.5.3 et §4.11.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en MPa.
 *
 * Repere du plan de joint (face commune des deux plats) : z le long du
 * recouvrement, dans le sens de l effort N ; y en travers. Le plat attache
 * occupe |y| <= b_p/2, son extremite en z = 0, le recouvrement jusqu a
 * z = L_r, au-dela duquel il se prolonge.
 *   - cordons lateraux : le long des bords y = +-b_p/2, de z = 0 a L_r ;
 *   - cordon frontal : le long de l extremite z = 0.
 */

import { REGLES_CORDONS, type ContexteCordons, type Regle } from '../dispositions/regles';
import { verifierDispositions, type ResultatDispositions } from '../dispositions/verifier-dispositions';
import { taux, type Taux } from '../domaines/taux-de-travail';
import type { Materiau } from '../model/materiau';
import { limiteElastique, resistanceUltime } from '../norms/acier';
import { betaW } from '../norms/beta-w';
import { ec3Recommande, validerProfil, type ProfilEC3 } from '../norms/ec3-recommande';
import type { CordonGroupe } from '../soudures/groupe';
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

export interface DonneesRecouvrement {
  /** Plat attache : largeur et epaisseur (mm). */
  b_p: number;
  t_p: number;
  /** Plat de base : largeur et epaisseur (mm). */
  b_b: number;
  t_b: number;
  /** Longueur de recouvrement (mm). */
  L_r: number;
  cordons: { lateraux: boolean; frontal: boolean };
  /** Gorge commune (mm). */
  a: number;
  /** Sollicitations au centre de gravite du groupe de cordons. */
  sollicitations: {
    /** Effort le long du recouvrement, traction du plat attache positive (kN). */
    N: number;
    /** Effort en travers, dans le plan (kN). */
    V: number;
    /** Moment dans le plan, sens trigonometrique (kN.m). */
    M: number;
  };
  materiau: Materiau;
  profil?: ProfilEC3;
}

export interface ResultatRecouvrement {
  detail: 'recouvrement';
  verdict: VerdictDetail;
  motif: string;
  constats: Constats;
  f_u: number;
  beta_w: number;
  /** Reduction des cordons lateraux longs, §4.11 (-). */
  beta_Lw: number;
  cordons: ResultatCordons;
  metalAttache: MetalDeBase;
  metalBase: MetalDeBase;
  dispositions: ResultatDispositions;
  taux: Taux[];
  mecanismeGouvernant: string;
}

/**
 * Reduction des assemblages longs a recouvrement, EN 1993-1-8 §4.11(1) :
 *   beta_Lw,1 = 1,2 - 0,2 L_j / (150 a) <= 1,0   des que L_j > 150 a.
 * La resistance d un cordon long n est pas proportionnelle a sa longueur :
 * ses extremites se chargent avant son milieu.
 */
export function reductionAssemblageLong(L_j: number, a: number): number {
  return L_j > 150 * a ? Math.min(1, 1.2 - (0.2 * L_j) / (150 * a)) : 1;
}

interface ContexteRecouvrement extends ContexteCordons {
  donnees: DonneesRecouvrement;
}

const REGLES_RECOUVREMENT: readonly Regle<ContexteRecouvrement>[] = [
  ...REGLES_CORDONS,
  {
    id: 'assemblage-long',
    clause: 'EN 1993-1-8 §4.11',
    severite: 'information',
    enonce: 'L_j > 150 a : resistance des cordons lateraux reduite par beta_Lw',
    applicabilite: ({ donnees }) =>
      donnees.cordons.lateraux && donnees.L_r > 150 * donnees.a ? null : 'assemblage court',
    evaluer: ({ donnees }) =>
      `L_j = ${donnees.L_r} mm > 150 a = ${150 * donnees.a} mm : beta_Lw = ` +
      `${reductionAssemblageLong(donnees.L_r, donnees.a).toFixed(3)} sur les cordons lateraux`,
  },
  {
    id: 'excentricite-recouvrement',
    clause: 'EN 1993-1-8 §4.12',
    severite: 'information',
    enonce: 'recouvrement simple : flexion d excentricite hors plan non calculee',
    applicabilite: () => null,
    evaluer: () =>
      'un recouvrement simple flechit hors de son plan sous l excentricite des deux plats ; ' +
      'cet effet n est pas calcule ici et doit etre empeche ou justifie a part',
  },
];

/**
 * Verification d un assemblage a recouvrement.
 *
 * Les cordons lateraux travaillent en cisaillement longitudinal (tau_para),
 * le cordon frontal en travers : l effort qui tire le plat attache hors du
 * recouvrement met sa gorge en TRACTION (sigma_perp > 0), et le second
 * critere du §4.5.3.2(6) s y applique.
 *
 * Le metal de base est verifie sur les deux plats, en section brute, sous
 * l effort total. La section nette n est pas en cause : un recouvrement soude
 * n est pas perce.
 */
export function verifierRecouvrement(d: DonneesRecouvrement): ResultatRecouvrement {
  const profil = validerProfil(d.profil ?? ec3Recommande());
  const b_p = positif(d.b_p, 'La largeur du plat attache b_p', 'mm');
  const t_p = positif(d.t_p, 'L epaisseur du plat attache t_p', 'mm');
  const b_b = positif(d.b_b, 'La largeur du plat de base b_b', 'mm');
  const t_b = positif(d.t_b, 'L epaisseur du plat de base t_b', 'mm');
  const L_r = positif(d.L_r, 'La longueur de recouvrement L_r', 'mm');
  const a = positif(d.a, 'La gorge a', 'mm');
  const N = fini(d.sollicitations.N, 'L effort N', 'kN');
  const V = fini(d.sollicitations.V, 'L effort V', 'kN');
  const M = fini(d.sollicitations.M, 'Le moment M', 'kN.m');
  if (!d.cordons.lateraux && !d.cordons.frontal) {
    throw new Error('Un recouvrement demande au moins un cordon, lateral ou frontal.');
  }

  const f_u = Math.min(resistanceUltime(d.materiau.nuance, t_p), resistanceUltime(d.materiau.nuance, t_b));
  const beta_w = betaW(d.materiau.nuance);
  const beta_Lw = reductionAssemblageLong(L_r, a);

  const groupe: CordonGroupe[] = [];
  if (d.cordons.lateraux) {
    groupe.push(cordon('lateral-1', b_p / 2, 0, b_p / 2, L_r, a, [1, 0]));
    groupe.push(cordon('lateral-2', -b_p / 2, 0, -b_p / 2, L_r, a, [-1, 0]));
  }
  if (d.cordons.frontal) {
    groupe.push(cordon('frontal', -b_p / 2, 0, b_p / 2, 0, a, [0, -1]));
  }
  const cordons = verifierCordons(groupe, { V_y: V, V_z: N, T: M }, (c) => ({
    f_u,
    beta_w,
    gamma_M2: profil.gamma_M2,
    beta_Lw: c.id.startsWith('lateral') ? beta_Lw : 1,
  }));

  const metalAttache = metalDeBase(
    t_p, b_p, { N, V_1: V, V_2: 0, M_L: M, M_t: 0 }, limiteElastique(d.materiau.nuance, t_p), profil.gamma_M0,
  );
  const metalBase = metalDeBase(
    t_b, b_b, { N, V_1: V, V_2: 0, M_L: M, M_t: 0 }, limiteElastique(d.materiau.nuance, t_b), profil.gamma_M0,
  );

  const ctx: ContexteRecouvrement = {
    donnees: d,
    cordons: [
      ...(d.cordons.lateraux ? [{ id: 'lateraux', a, l: L_r, t_min: Math.min(t_p, t_b), type: 'angle' as const }] : []),
      ...(d.cordons.frontal ? [{ id: 'frontal', a, l: b_p, t_min: Math.min(t_p, t_b), type: 'angle' as const }] : []),
    ],
    epaisseurs: [t_p, t_b],
  };
  const dispositions = verifierDispositions(REGLES_RECOUVREMENT, ctx);

  const fin = conclure(
    [
      taux('soudure', 'EN 1993-1-8 §4.5.3.2', `cordons d angle, ${cordons.gouvernant.cordon}`, cordons.taux),
      taux('metal-attache', 'EN 1993-1-1 §6.2.1(5)', 'plat attache, section brute', metalAttache.taux),
      taux('metal-base', 'EN 1993-1-1 §6.2.1(5)', 'plat de base, section brute', metalBase.taux),
    ],
    dispositions,
  );
  return {
    detail: 'recouvrement',
    ...fin,
    f_u,
    beta_w,
    beta_Lw,
    cordons,
    metalAttache,
    metalBase,
    dispositions,
  };
}
