/**
 * Eclissage boulonne sous effort axial : boulons ordinaires en cisaillement
 * (categorie A, travaillant a la pression diametrale) — EN 1993-1-8:2005
 * §3.4 a §3.10, EN 1993-1-1 §6.2.3.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 *
 * Geometrie : un plat attache (b_p × t_p) et un plat de base (b_b × t_b),
 * assembles par n_1 rangees de boulons dans le sens de l'effort et n_2 files
 * en travers, aux entraxes p_1 et p_2 ; pince longitudinale e_1 dans chaque
 * plat ; pince transversale e_2 deduite de la largeur de chaque plat,
 * boulons centres. Double recouvrement (n_s = 2) : t_b est l'epaisseur
 * totale des couvre-joints, b_b leur largeur.
 *
 * L'effort N_Ed est centre sur le groupe et se partage egalement entre les
 * boulons. Choix declares : un seul schema de cisaillement de bloc (bloc
 * central entre les files extremes) ; flexion d'excentricite d'un
 * recouvrement simple non calculee (information).
 */

import type { ResultatDispositions } from '../dispositions/verifier-dispositions';
import { verifierDispositions } from '../dispositions/verifier-dispositions';
import type { Regle } from '../dispositions/regles';
import { sansObjet, taux, type Taux } from '../domaines/taux-de-travail';
import type { Materiau } from '../model/materiau';
import { limiteElastique, resistanceUltime } from '../norms/acier';
import { airesBoulon, alphaV, diametreTrou, resistancesBoulon, type ClasseBoulon, type DiametreBoulon } from '../norms/boulons';
import { ec3Recommande, validerProfil, type ProfilEC3 } from '../norms/ec3-recommande';
import { conclure, fini, positif, type Constats, type VerdictDetail } from './commun';

const N_PAR_KN = 1000;

export interface DonneesEclissage {
  /** Plat attache (mm). */
  b_p: number;
  t_p: number;
  /** Plat de base, ou couvre-joints en double recouvrement (mm). */
  b_b: number;
  t_b: number;
  /** Nombre de plans de cisaillement : 1 (recouvrement simple) ou 2 (double). */
  n_s: 1 | 2;
  boulons: {
    classe: ClasseBoulon;
    d: DiametreBoulon;
    /** Le plan de cisaillement passe par la partie filetee. */
    filetageDansLePlan: boolean;
  };
  /** Rangees dans le sens de l'effort, files en travers. */
  n_1: number;
  n_2: number;
  /** Pince longitudinale et entraxes (mm). */
  e_1: number;
  p_1: number;
  p_2: number;
  /** Effort axial de calcul, traction positive (kN). */
  N: number;
  materiau: Materiau;
  profil?: ProfilEC3;
}

/** Resistance a la pression diametrale d'un type de boulon (position). */
export interface PressionBoulon {
  position: string;
  nombre: number;
  alpha_b: number;
  k_1: number;
  /** F_b,Rd du plat le plus defavorable (kN). */
  F_b_Rd: number;
  plat: string;
}

export interface PlatEclisse {
  nom: string;
  b: number;
  t: number;
  e_2: number;
  f_y: number;
  f_u: number;
  /** Section nette, section brute (mm2). */
  A_net: number;
  A: number;
  /** N_t,Rd = min(N_pl,Rd, N_u,Rd) (kN), (6.6) et (6.7). */
  N_pl_Rd: number;
  N_u_Rd: number;
  /** Cisaillement de bloc V_eff,1,Rd (kN), (3.9) ; null avec une seule file. */
  V_eff_Rd: number | null;
  A_nt: number;
  A_nv: number;
}

export interface ResultatEclissage {
  detail: 'eclissage-boulonne';
  verdict: VerdictDetail;
  motif: string;
  constats: Constats;
  d_0: number;
  n_b: number;
  f_ub: number;
  alpha_v: number;
  /** Reduction des assemblages longs, §3.8 (-). */
  beta_Lf: number;
  L_j: number;
  /** Resistance au cisaillement par boulon, tous plans et beta_Lf compris (kN). */
  F_v_Rd: number;
  F_v_Ed: number;
  pression: PressionBoulon[];
  /** Resistance du groupe, §3.7(1) (kN), et la regle appliquee. */
  F_groupe: number;
  regleGroupe: string;
  plats: PlatEclisse[];
  dispositions: ResultatDispositions;
  taux: Taux[];
  mecanismeGouvernant: string;
}

interface Geometrie {
  d: DonneesEclissage;
  d_0: number;
  /** Pinces transversales des deux plats (mm). */
  e_2: { attache: number; base: number };
}

const REGLES: readonly Regle<Geometrie>[] = [
  {
    id: 'e1-min',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'bloquante',
    enonce: 'e_1 >= 1,2 d_0',
    applicabilite: () => null,
    evaluer: ({ d, d_0 }) => (d.e_1 >= 1.2 * d_0 ? null : `e_1 = ${d.e_1} mm < 1,2 d_0 = ${(1.2 * d_0).toFixed(1)} mm`),
  },
  {
    id: 'e2-min',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'bloquante',
    enonce: 'e_2 >= 1,2 d_0, dans chaque plat',
    applicabilite: () => null,
    evaluer: ({ e_2, d_0 }) => {
      const m = Math.min(e_2.attache, e_2.base);
      return m >= 1.2 * d_0 ? null : `e_2 = ${m.toFixed(1)} mm < 1,2 d_0 = ${(1.2 * d_0).toFixed(1)} mm`;
    },
  },
  {
    id: 'p1-min',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'bloquante',
    enonce: 'p_1 >= 2,2 d_0',
    applicabilite: ({ d }) => (d.n_1 > 1 ? null : 'une seule rangee'),
    evaluer: ({ d, d_0 }) => (d.p_1 >= 2.2 * d_0 ? null : `p_1 = ${d.p_1} mm < 2,2 d_0 = ${(2.2 * d_0).toFixed(1)} mm`),
  },
  {
    id: 'p2-min',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'bloquante',
    enonce: 'p_2 >= 2,4 d_0',
    applicabilite: ({ d }) => (d.n_2 > 1 ? null : 'une seule file'),
    evaluer: ({ d, d_0 }) => (d.p_2 >= 2.4 * d_0 ? null : `p_2 = ${d.p_2} mm < 2,4 d_0 = ${(2.4 * d_0).toFixed(1)} mm`),
  },
  {
    id: 'pinces-max',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'avertissement',
    enonce: 'pieces exposees : e_1, e_2 <= 4 t + 40 mm',
    applicabilite: () => null,
    evaluer: ({ d, e_2 }) => {
      const t = Math.min(d.t_p, d.t_b);
      const lim = 4 * t + 40;
      const e = Math.max(d.e_1, e_2.attache, e_2.base);
      return e <= lim ? null : `pince ${e.toFixed(1)} mm > 4 t + 40 = ${lim} mm (pieces exposees aux intemperies)`;
    },
  },
  {
    id: 'entraxes-max',
    clause: 'EN 1993-1-8 tableau 3.3',
    severite: 'avertissement',
    enonce: 'p_1, p_2 <= min(14 t ; 200 mm)',
    applicabilite: ({ d }) => (d.n_1 > 1 || d.n_2 > 1 ? null : 'un seul boulon'),
    evaluer: ({ d }) => {
      const lim = Math.min(14 * Math.min(d.t_p, d.t_b), 200);
      const p = Math.max(d.n_1 > 1 ? d.p_1 : 0, d.n_2 > 1 ? d.p_2 : 0);
      return p <= lim ? null : `entraxe ${p} mm > min(14 t ; 200) = ${lim} mm`;
    },
  },
  {
    id: 'recouvrement-simple',
    clause: 'EN 1993-1-8 §3.6.1(10)',
    severite: 'information',
    enonce: 'recouvrement simple : excentricite hors plan',
    applicabilite: ({ d }) => (d.n_s === 1 ? null : 'double recouvrement'),
    evaluer: () =>
      'un recouvrement simple flechit hors de son plan sous l excentricite des deux plats ; cet effet n est pas calcule ici. ' +
      'Avec une seule rangee, des rondelles trempees sont exigees sous tete et ecrou (§3.6.1(10)).',
  },
];

/** k_1 du tableau 3.4, boulon de rive (bord) ou interieur en travers. */
function k1(rive: boolean, e_2: number, p_2: number, d_0: number, n_2: number): number {
  const parEntraxe = n_2 > 1 ? 1.4 * (p_2 / d_0) - 1.7 : Infinity;
  const parPince = rive ? 2.8 * (e_2 / d_0) - 1.7 : Infinity;
  return Math.min(parPince, parEntraxe, 2.5);
}

/**
 * Verification d'un eclissage boulonne sous effort axial.
 */
export function verifierEclissage(d: DonneesEclissage): ResultatEclissage {
  const profil = validerProfil(d.profil ?? ec3Recommande());
  const g2 = profil.gamma_M2;
  const g0 = profil.gamma_M0;
  positif(d.b_p, 'La largeur du plat attache b_p', 'mm');
  positif(d.t_p, 'L epaisseur du plat attache t_p', 'mm');
  positif(d.b_b, 'La largeur du plat de base b_b', 'mm');
  positif(d.t_b, 'L epaisseur du plat de base t_b', 'mm');
  positif(d.e_1, 'La pince longitudinale e_1', 'mm');
  const N = fini(d.N, 'L effort N', 'kN');
  if (N < 0) throw new Error('Cet eclissage est verifie en traction : N doit etre positif ou nul (kN).');
  if (d.n_s !== 1 && d.n_s !== 2) throw new Error('Le nombre de plans de cisaillement n_s vaut 1 ou 2.');
  for (const [v, nom] of [[d.n_1, 'n_1'], [d.n_2, 'n_2']] as const) {
    if (!Number.isInteger(v) || v < 1) throw new Error(`Le nombre ${nom} doit etre un entier au moins egal a 1.`);
  }
  if (d.n_1 > 1) positif(d.p_1, 'L entraxe p_1', 'mm');
  if (d.n_2 > 1) positif(d.p_2, 'L entraxe p_2', 'mm');

  const { d: diam, classe, filetageDansLePlan } = d.boulons;
  const d_0 = diametreTrou(diam);
  const { A_s, A } = airesBoulon(diam);
  const { f_ub } = resistancesBoulon(classe);
  const n_b = d.n_1 * d.n_2;
  const largeurGroupe = d.n_2 > 1 ? (d.n_2 - 1) * d.p_2 : 0;
  const e_2 = { attache: (d.b_p - largeurGroupe) / 2, base: (d.b_b - largeurGroupe) / 2 };
  if (e_2.attache <= 0 || e_2.base <= 0) {
    throw new Error('Les files de boulons debordent d un plat : (n_2 - 1) p_2 doit rester inferieur a la largeur (mm).');
  }

  // Cisaillement des boulons, tableau 3.4, et assemblages longs, §3.8.
  const alpha_v = alphaV(classe, filetageDansLePlan);
  const L_j = d.n_1 > 1 ? (d.n_1 - 1) * d.p_1 : 0;
  const beta_Lf = L_j > 15 * diam ? Math.max(0.75, Math.min(1, 1 - (L_j - 15 * diam) / (200 * diam))) : 1;
  const F_v_Rd = (d.n_s * alpha_v * f_ub * (filetageDansLePlan ? A_s : A) * beta_Lf) / g2 / N_PAR_KN;
  const F_v_Ed = N / n_b;

  // Pression diametrale, tableau 3.4, pour chaque position et chaque plat.
  const plats = [
    { nom: 'plat attache', t: d.t_p, e_2: e_2.attache, f_u: resistanceUltime(d.materiau.nuance, d.t_p) },
    { nom: d.n_s === 2 ? 'couvre-joints' : 'plat de base', t: d.t_b, e_2: e_2.base, f_u: resistanceUltime(d.materiau.nuance, d.t_b) },
  ];
  const positions: { nom: string; bout: boolean; rive: boolean; nombre: number }[] = [];
  // Une rangee d'extremite (la plus proche du bout du plat), les autres interieures.
  const nBout = 1;
  const nInt1 = d.n_1 - nBout;
  const nRive = d.n_2 > 1 ? 2 : 1;
  const nInt2 = d.n_2 - nRive;
  positions.push({ nom: 'rangee d extremite, file de rive', bout: true, rive: true, nombre: nBout * nRive });
  if (nInt2 > 0) positions.push({ nom: 'rangee d extremite, file interieure', bout: true, rive: false, nombre: nBout * nInt2 });
  if (nInt1 > 0) positions.push({ nom: 'rangee interieure, file de rive', bout: false, rive: true, nombre: nInt1 * nRive });
  if (nInt1 > 0 && nInt2 > 0) positions.push({ nom: 'rangee interieure, file interieure', bout: false, rive: false, nombre: nInt1 * nInt2 });

  const pression: PressionBoulon[] = positions.map((pos) => {
    let pire: PressionBoulon | null = null;
    for (const pl of plats) {
      const alpha_d = pos.bout ? d.e_1 / (3 * d_0) : d.p_1 / (3 * d_0) - 0.25;
      const alpha_b = Math.min(alpha_d, f_ub / pl.f_u, 1);
      const k = k1(pos.rive, pl.e_2, d.p_2, d_0, d.n_2);
      let F = (k * alpha_b * pl.f_u * diam * pl.t) / g2 / N_PAR_KN;
      // §3.6.1(10) : recouvrement simple a un seul boulon, F_b,Rd <= 1,5 f_u d t / gamma_M2.
      if (d.n_s === 1 && n_b === 1) F = Math.min(F, (1.5 * pl.f_u * diam * pl.t) / g2 / N_PAR_KN);
      if (k <= 0 || alpha_b <= 0) F = 0;
      if (pire === null || F < pire.F_b_Rd) pire = { position: pos.nom, nombre: pos.nombre, alpha_b, k_1: k, F_b_Rd: F, plat: pl.nom };
    }
    return pire as PressionBoulon;
  });

  // Groupe, §3.7(1).
  const cisaillementSuffit = pression.every((p) => F_v_Rd >= p.F_b_Rd);
  const F_groupe = cisaillementSuffit
    ? pression.reduce((s, p) => s + p.nombre * p.F_b_Rd, 0)
    : n_b * Math.min(F_v_Rd, ...pression.map((p) => p.F_b_Rd));
  const regleGroupe = cisaillementSuffit
    ? 'F_v,Rd >= F_b,Rd pour chaque boulon : somme des F_b,Rd (§3.7(1))'
    : 'n_b × min(F_v,Rd ; F_b,Rd) (§3.7(1))';

  // Plats : section brute, section nette, cisaillement de bloc.
  const platsVerifies: PlatEclisse[] = plats.map((pl) => {
    const f_y = limiteElastique(d.materiau.nuance, pl.t);
    const b = pl.nom === 'plat attache' ? d.b_p : d.b_b;
    const Abrut = b * pl.t;
    const A_net = (b - d.n_2 * d_0) * pl.t;
    const N_pl_Rd = (Abrut * f_y) / g0 / N_PAR_KN;
    const N_u_Rd = (0.9 * A_net * pl.f_u) / g2 / N_PAR_KN;
    // Bloc central : traction entre les files extremes, cisaillement le long des deux files.
    const A_nt = d.n_2 > 1 ? ((d.n_2 - 1) * d.p_2 - (d.n_2 - 1) * d_0) * pl.t : 0;
    const A_nv = 2 * (d.e_1 + (d.n_1 - 1) * d.p_1 - (d.n_1 - 0.5) * d_0) * pl.t;
    const V_eff_Rd = d.n_2 > 1 ? ((pl.f_u * A_nt) / g2 + (f_y * A_nv) / (Math.sqrt(3) * g0)) / N_PAR_KN : null;
    return { nom: pl.nom, b, t: pl.t, e_2: pl.e_2, f_y, f_u: pl.f_u, A_net, A: Abrut, N_pl_Rd, N_u_Rd, V_eff_Rd, A_nt, A_nv };
  });
  for (const pl of platsVerifies) {
    if (pl.A_net <= 0) throw new Error(`${pl.nom} : section nette nulle ou negative, les trous occupent toute la largeur.`);
  }

  const dispositions = verifierDispositions(REGLES, { d, d_0, e_2 });

  const liste: Taux[] = [
    taux('boulons-cisaillement', 'EN 1993-1-8 tableau 3.4', `cisaillement des boulons (${d.n_s} plan${d.n_s > 1 ? 's' : ''})`, F_v_Ed / F_v_Rd),
    taux('pression-diametrale', 'EN 1993-1-8 tableau 3.4', 'pression diametrale, boulon le plus faible', F_v_Ed / Math.min(...pression.map((p) => p.F_b_Rd))),
    taux('groupe', 'EN 1993-1-8 §3.7(1)', 'groupe de boulons', N / F_groupe),
  ];
  for (const pl of platsVerifies) {
    liste.push(taux(`brut-${pl.nom}`, 'EN 1993-1-1 (6.6)', `${pl.nom}, section brute`, N / pl.N_pl_Rd));
    liste.push(taux(`net-${pl.nom}`, 'EN 1993-1-1 (6.7)', `${pl.nom}, section nette`, N / pl.N_u_Rd));
    liste.push(
      pl.V_eff_Rd === null
        ? sansObjet(`bloc-${pl.nom}`, 'EN 1993-1-8 §3.10.2', `${pl.nom}, cisaillement de bloc`, 'une seule file : schema de bloc central sans objet')
        : taux(`bloc-${pl.nom}`, 'EN 1993-1-8 §3.10.2 (3.9)', `${pl.nom}, cisaillement de bloc`, N / pl.V_eff_Rd)
    );
  }
  const fin = conclure(liste, dispositions);

  return {
    detail: 'eclissage-boulonne',
    ...fin,
    d_0,
    n_b,
    f_ub,
    alpha_v,
    beta_Lf,
    L_j,
    F_v_Rd,
    F_v_Ed,
    pression,
    F_groupe,
    regleGroupe,
    plats: platsVerifies,
    dispositions,
  };
}
