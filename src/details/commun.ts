/**
 * Socle commun des details types soudes.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en MPa.
 *
 * Chaque detail decrit sa geometrie par un groupe de cordons dans le plan de
 * joint (soudures/groupe.ts) ; ce module les verifie point par point par les
 * deux methodes du §4.5.3 et assemble les trois constats. Pas de service ici :
 * le critere de service est propre aux tetes d ancrage.
 */

import type { ResultatDispositions } from '../dispositions/verifier-dispositions';
import { gouvernant, trierTaux, type Taux } from '../domaines/taux-de-travail';
import { verifierDirectionnelle, type ResultatDirectionnel } from '../soudures/directionnelle';
import {
  analyserGroupe,
  type CordonGroupe,
  type ResultatGroupe,
  type SollicitationsGroupe,
} from '../soudures/groupe';
import { verifierSimplifiee, type ResultatSimplifie } from '../soudures/simplifiee';

export type VerdictDetail = 'conforme' | 'non-conforme-resistance' | 'non-conforme-dispositions';

export interface VerificationPoint {
  cordon: string;
  /** Extremite 1 ou 2 du cordon. */
  extremite: 1 | 2;
  y: number;
  z: number;
  directionnelle: ResultatDirectionnel;
  simplifiee: ResultatSimplifie;
}

export interface ResultatCordons {
  groupe: ResultatGroupe;
  points: VerificationPoint[];
  gouvernant: VerificationPoint;
  /** Taux de la methode directionnelle au point gouvernant (-). */
  taux: number;
  /** Vrai si les deux methodes coincident au point gouvernant. */
  methodesCoincident: boolean;
}

/**
 * Cordon decrit par ses extremites et la direction de e_2 (a l oppose de
 * l element attache) : le sens `cote` s en deduit, ce qui evite de raisonner
 * sur l orientation du segment.
 */
export function cordon(
  id: string,
  y1: number,
  z1: number,
  y2: number,
  z2: number,
  a: number,
  e2: [number, number],
  options: Partial<Pick<CordonGroupe, 'type' | 'reprendVy' | 'reprendVz'>> = {},
): CordonGroupe {
  const u_y = y2 - y1;
  const u_z = z2 - z1;
  // Normale obtenue en tournant l axe de +90 degres : (-u_z, u_y).
  const produit = -u_z * e2[0] + u_y * e2[1];
  return { id, y1, z1, y2, z2, a, cote: produit >= 0 ? 1 : -1, ...options };
}

/** Tolerance d effort transversal nul (MPa). */
const NUL = 1e-9;

/**
 * Verifie chaque extremite de chaque cordon.
 *
 * `resistance(c)` rend la resistance du cordon : elle peut differer d un
 * cordon a l autre (reduction beta_Lw des seuls cordons longs d un
 * recouvrement, §4.11).
 */
export function verifierCordons(
  cordons: readonly CordonGroupe[],
  sollicitations: SollicitationsGroupe,
  resistance: (c: CordonGroupe) => { f_u: number; beta_w: number; gamma_M2: number; beta_Lw?: number },
): ResultatCordons {
  const groupe = analyserGroupe(cordons, sollicitations);
  const points: VerificationPoint[] = [];
  for (const etat of groupe.cordons) {
    const r = resistance(etat.cordon);
    etat.points.forEach((p, i) => {
      points.push({
        cordon: etat.cordon.id,
        extremite: i === 0 ? 1 : 2,
        y: p.y,
        z: p.z,
        directionnelle: verifierDirectionnelle(p.gorge, r),
        simplifiee: verifierSimplifiee(p.efforts, etat.cordon.a, r),
      });
    });
  }
  let max = points[0];
  for (const p of points) if (p.directionnelle.taux > max.directionnelle.taux) max = p;
  const g = max.directionnelle;
  return {
    groupe,
    points,
    gouvernant: max,
    taux: g.taux,
    methodesCoincident: Math.abs(g.sigma_perp) < NUL && Math.abs(g.tau_perp) < NUL,
  };
}

export interface Constats {
  resistance: { ok: boolean; motif: string };
  dispositions: { ok: boolean; motif: string };
}

/** Taux tries, verdict et motif, a partir de la liste des mecanismes. */
export function conclure(
  liste: Taux[],
  dispositions: ResultatDispositions,
): { taux: Taux[]; verdict: VerdictDetail; motif: string; constats: Constats; mecanismeGouvernant: string } {
  const taux = trierTaux(liste);
  const max = gouvernant(taux);
  const resistanceOk = max === null || max.valeur <= 1;
  const constats: Constats = {
    resistance: {
      ok: resistanceOk,
      motif:
        max === null
          ? 'aucun mecanisme de resistance applicable'
          : `${resistanceOk ? 'resistance suffisante' : 'resistance insuffisante'} : mecanisme le plus sollicite ` +
            `« ${max.libelle} » (${max.clause}), taux ${max.valeur.toFixed(3)}`,
    },
    dispositions: {
      ok: dispositions.ok,
      motif: dispositions.ok
        ? 'aucune disposition bloquante n est enfreinte'
        : `${dispositions.violations.length} disposition(s) enfreinte(s) : ${dispositions.violations.join(' ; ')}`,
    },
  };
  const verdict: VerdictDetail = !resistanceOk
    ? 'non-conforme-resistance'
    : !dispositions.ok
      ? 'non-conforme-dispositions'
      : 'conforme';
  const motif =
    verdict === 'conforme'
      ? `Conforme : ${constats.resistance.motif}.`
      : verdict === 'non-conforme-resistance'
        ? `Non conforme en resistance : ${constats.resistance.motif}.`
        : `Non conforme aux dispositions constructives : ${constats.dispositions.motif}.`;
  return { taux, verdict, motif, constats, mecanismeGouvernant: max?.id ?? 'aucun' };
}

/** Grandeur strictement positive, ou refus nommant la grandeur et son unite. */
export function positif(v: number | undefined, nom: string, unite: string): number {
  if (v === undefined || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return v;
}

/** Grandeur finie (sollicitation signee), 0 si absente. */
export function fini(v: number | undefined, nom: string, unite: string): number {
  const x = v ?? 0;
  if (!Number.isFinite(x)) {
    throw new Error(`${nom} doit etre un nombre fini (${unite}).`);
  }
  return x;
}

export interface MetalDeBase {
  /** Contrainte normale maximale, somme des valeurs absolues (MPa). */
  sigma: number;
  /** Cisaillement maximal, 1,5 V / A (MPa). */
  tau: number;
  /** racine(sigma^2 + 3 tau^2) (MPa). */
  sigma_eq: number;
  /** f_y / gamma_M0 (MPa). */
  limite: number;
  taux: number;
}

/**
 * Section rectangulaire de metal de base t x L sous N, deux moments et deux
 * tranchants, critere elastique de l EN 1993-1-1 §6.2.1(5).
 *
 * Les contraintes maximales sont cumulees comme si elles coexistaient au meme
 * point, et le cisaillement pris a sa valeur maximale : simplification
 * conservative, qui evite de rechercher le point critique.
 */
export function metalDeBase(
  t: number,
  L: number,
  s: { N: number; V_1: number; V_2: number; M_L: number; M_t: number },
  f_y: number,
  gamma_M0: number,
): MetalDeBase {
  const A = t * L;
  const sigma =
    (Math.abs(s.N) * 1000) / A +
    (Math.abs(s.M_L) * 1e6 * 6) / (t * L ** 2) +
    (Math.abs(s.M_t) * 1e6 * 6) / (L * t ** 2);
  const tau = (1.5 * Math.hypot(s.V_1, s.V_2) * 1000) / A;
  const sigma_eq = Math.sqrt(sigma ** 2 + 3 * tau ** 2);
  const limite = f_y / gamma_M0;
  return { sigma, tau, sigma_eq, limite, taux: sigma_eq / limite };
}
