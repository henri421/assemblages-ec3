/**
 * Contraintes dans la section de gorge d un cordon — EN 1993-1-8:2005 §4.5.3.2.
 *
 * Unites : efforts lineiques en kN/mm, gorge en mm, contraintes en MPa.
 *
 * Reperage d un cordon. L element ATTACHE (plat, ame, profile) est soude sur
 * un element de BASE (platine, plat traversant). A la racine du cordon :
 *   e_1  le long de la face de l element attache, en s eloignant de la racine ;
 *   e_2  le long de la face de l element de base, en s eloignant de l element
 *        attache ;
 *   e_para  le long de l axe du cordon.
 * Les efforts `p_1`, `p_2`, `p_para` sont ceux que la sollicitation applique a
 * l element attache, par unite de longueur de cordon, projetes sur ce repere.
 * Un `p_1` positif arrache l element attache de sa base.
 */

/** Conversion explicite : 1 kN = 1000 N. Aucune autre conversion d unite. */
export const N_PAR_KN = 1000;

export type TypeCordon = 'angle' | 'penetration-partielle';

export interface EffortsLineiques {
  /** Effort selon e_1, arrachement positif (kN/mm). */
  p_1: number;
  /** Effort selon e_2 (kN/mm). */
  p_2: number;
  /** Effort selon l axe du cordon (kN/mm). */
  p_para: number;
}

export interface ContraintesGorge {
  /** Contrainte normale perpendiculaire a la gorge, traction positive (MPa). */
  sigma_perp: number;
  /** Cisaillement perpendiculaire a l axe du cordon, dans la gorge (MPa). */
  tau_perp: number;
  /** Cisaillement parallele a l axe du cordon (MPa). */
  tau_para: number;
}

/** Gorge strictement positive, ou refus nommant la grandeur et son unite. */
export function gorgeValide(a: number): number {
  if (!Number.isFinite(a) || a <= 0) {
    throw new Error('La gorge a du cordon doit etre un nombre strictement positif (mm).');
  }
  return a;
}

function effortFini(valeur: number, nom: string): number {
  if (!Number.isFinite(valeur)) {
    throw new Error(`L effort lineique ${nom} doit etre un nombre fini (kN/mm).`);
  }
  return valeur;
}

/**
 * Contraintes sigma_perp, tau_perp, tau_para dans la section de gorge,
 * EN 1993-1-8 §4.5.3.2(4) et figure 4.5.
 *
 * Cordon d angle : la gorge est le plan bissecteur, a 45 degres. Sa normale,
 * orientee de la base vers l element attache, vaut (e_1 - e_2)/racine(2) ;
 * d ou
 *   sigma_perp = (p_1 - p_2) / (racine(2) * a)
 *   tau_perp   = (p_1 + p_2) / (racine(2) * a)
 * Le signe de sigma_perp n est pas une convention d affichage : il decide de
 * l applicabilite du second critere du §4.5.3.2(6), qui ne vise que la traction.
 * Un effort qui plaque l element attache contre sa base (p_1 < 0) comprime la
 * gorge ; un effort qui le tire vers le cordon (p_2 > 0) la comprime aussi.
 *
 * Penetration partielle : EN 1993-1-8 §4.7.2 la calcule comme un cordon d angle
 * a penetration profonde, dont la gorge est ici prise perpendiculaire a l axe
 * de l element attache, c est-a-dire parallele a la face de base :
 *   sigma_perp = p_1 / a,  tau_perp = p_2 / a.
 */
export function contraintesDansLaGorge(
  efforts: EffortsLineiques,
  a: number,
  type: TypeCordon = 'angle',
): ContraintesGorge {
  gorgeValide(a);
  const p_1 = effortFini(efforts.p_1, 'p_1');
  const p_2 = effortFini(efforts.p_2, 'p_2');
  const p_para = effortFini(efforts.p_para, 'p_para');

  const tau_para = (p_para * N_PAR_KN) / a;
  if (type === 'penetration-partielle') {
    return {
      sigma_perp: (p_1 * N_PAR_KN) / a,
      tau_perp: (p_2 * N_PAR_KN) / a,
      tau_para,
    };
  }
  return {
    sigma_perp: ((p_1 - p_2) * N_PAR_KN) / (Math.SQRT2 * a),
    tau_perp: ((p_1 + p_2) * N_PAR_KN) / (Math.SQRT2 * a),
    tau_para,
  };
}
