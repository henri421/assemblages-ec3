/**
 * Verification des cordons d une tete d ancrage — EN 1993-1-8:2005 §4.5.3.
 *
 * Unites : efforts lineiques en kN/mm, contraintes en MPa, longueurs en mm.
 */

import { contraintesDansLaGorge } from './gorge';
import { verifierDirectionnelle, type ResistanceSoudure, type ResultatDirectionnel } from './directionnelle';
import { verifierSimplifiee, type ResultatSimplifie } from './simplifiee';
import type { CasCordon, FluxSoudures } from './flux';
import type { ResultatPleineResistance } from './pleine-resistance';

export interface VerificationCas {
  cas: CasCordon;
  directionnelle: ResultatDirectionnel;
  simplifiee: ResultatSimplifie;
}

export interface ResultatSoudures {
  flux: FluxSoudures;
  /** Gorge (mm). */
  a: number;
  verifications: VerificationCas[];
  /** Cas le plus sollicite selon la methode directionnelle. */
  gouvernant: VerificationCas;
  /** Taux retenu : celui de la methode directionnelle (-). */
  taux: number;
  /**
   * Vrai quand les deux methodes coincident sur le cas gouvernant
   * (cisaillement longitudinal pur) : un seul resultat est alors a presenter.
   */
  methodesCoincident: boolean;
  pleineResistance: ResultatPleineResistance;
}

/** Tolerance d effort transversal nul (kN/mm). */
const EFFORT_NUL = 1e-12;

/**
 * Verifie chaque cas de cordon par les deux methodes du §4.5.3, et retient la
 * methode DIRECTIONNELLE pour le verdict.
 *
 * Pourquoi : l EN 1993-1-8 admet l une ou l autre (§4.5.3.1(1)). La
 * simplifiee est toujours du cote de la securite ; la declarer gouvernante
 * rendrait non conforme une soudure que la norme accepte. Elle reste
 * affichee, parce qu un controleur la refait souvent a la main.
 *
 * Les deux methodes COINCIDENT RIGOUREUSEMENT en cisaillement longitudinal
 * pur. Le resultat le signale pour que l interface n affiche pas deux valeurs
 * — identiques — comme s il s agissait de deux constats.
 */
export function verifierSoudures(
  flux: FluxSoudures,
  a: number,
  resistance: ResistanceSoudure,
  pleineResistance: ResultatPleineResistance,
): ResultatSoudures {
  if (flux.cas.length === 0) {
    throw new Error('Aucun cas de cordon a verifier.');
  }
  const verifications = flux.cas.map((cas) => ({
    cas,
    directionnelle: verifierDirectionnelle(contraintesDansLaGorge(cas.efforts, a), resistance),
    simplifiee: verifierSimplifiee(cas.efforts, a, resistance),
  }));

  let gouvernant = verifications[0];
  for (const v of verifications) {
    if (v.directionnelle.taux > gouvernant.directionnelle.taux) gouvernant = v;
  }

  const { p_1, p_2 } = gouvernant.cas.efforts;
  const methodesCoincident = Math.abs(p_1) < EFFORT_NUL && Math.abs(p_2) < EFFORT_NUL;

  return {
    flux,
    a,
    verifications,
    gouvernant,
    taux: gouvernant.directionnelle.taux,
    methodesCoincident,
    pleineResistance,
  };
}
