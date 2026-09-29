/**
 * Effort de dimensionnement d une tete d ancrage.
 *
 *   N_Ed = max( N_ELU ; P_p ; 0,9 * F_tk )
 *
 * Unites : efforts en kN, angles en degres.
 */

import type { Actions } from '../model/actions';

/** Terme qui gouverne l effort de dimensionnement. */
export type OrigineEffort = 'ELU' | 'epreuve' | 'capacite-armature';

/**
 * Inclinaison au-dela de laquelle la composante tangentielle n est plus
 * negligee (degres). Au-dessous, l ecart releve des tolerances de pose du
 * tirant (EN 1537) et la platine est reputee chargee normalement.
 */
export const INCLINAISON_TOLEREE = 3;

/** Part de la resistance caracteristique de l armature a couvrir (-). */
const FRACTION_CAPACITE_ARMATURE = 0.9;

export interface EffortDimensionnant {
  /** Effort de dimensionnement (kN). */
  N_Ed: number;
  /** Terme gouvernant. */
  origine: OrigineEffort;
  /** Les trois termes compares, `null` quand la donnee manque (kN). */
  termes: { ELU: number; epreuve: number | null; capaciteArmature: number | null };
  /** Inclinaison saisie (degres). */
  inclinaison: number;
  /** Composante tangentielle N_Ed * sin(alpha), nulle sous 3 degres (kN). */
  H_Ed: number;
  /** Vrai quand l inclinaison depasse la tolerance et que H_Ed est introduit. */
  inclinaisonPriseEnCompte: boolean;
}

function positif(valeur: number, nom: string): number {
  if (!Number.isFinite(valeur) || valeur <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (kN).`);
  }
  return valeur;
}

/**
 * Effort de dimensionnement de la piece metallique et terme qui le gouverne.
 *
 * Reference : pratique des tirants precontraints, EN 1537 et CFMS TA 2020 ;
 * les resistances de la piece relevent ensuite de l EN 1993-1-8.
 *
 * Pourquoi le maximum des trois termes et non le seul effort ELU : un ancrage
 * non visitable est soumis a une charge d epreuve lors de l essai de reception,
 * et sa ruine doit se produire dans l armature, jamais dans la piece
 * metallique. La piece doit donc tenir l epreuve, et 90 % de la resistance
 * caracteristique de l armature — sinon c est elle qui cederait la premiere.
 *
 * En cas d egalite, l ordre ELU, epreuve, capacite-armature decide : on
 * nomme le terme le plus « courant », celui que l ingenieur reconnait.
 */
export function effortDimensionnant(actions: Actions, inclinaison = 0): EffortDimensionnant {
  const ELU = positif(actions.N_ELU, 'L effort ELU N_ELU');
  const epreuve = actions.P_p === undefined ? null : positif(actions.P_p, 'La traction d epreuve P_p');
  const capaciteArmature =
    actions.F_tk === undefined
      ? null
      : FRACTION_CAPACITE_ARMATURE * positif(actions.F_tk, 'La resistance de l armature F_tk');

  if (!Number.isFinite(inclinaison) || inclinaison < 0 || inclinaison >= 90) {
    throw new Error("L inclinaison du tirant doit etre comprise dans [0 ; 90[ (degres).");
  }

  let N_Ed = ELU;
  let origine: OrigineEffort = 'ELU';
  if (epreuve !== null && epreuve > N_Ed) {
    N_Ed = epreuve;
    origine = 'epreuve';
  }
  if (capaciteArmature !== null && capaciteArmature > N_Ed) {
    N_Ed = capaciteArmature;
    origine = 'capacite-armature';
  }

  const inclinaisonPriseEnCompte = inclinaison > INCLINAISON_TOLEREE;
  const H_Ed = inclinaisonPriseEnCompte ? N_Ed * Math.sin((inclinaison / 180) * Math.PI) : 0;

  return {
    N_Ed,
    origine,
    termes: { ELU, epreuve, capaciteArmature },
    inclinaison,
    H_Ed,
    inclinaisonPriseEnCompte,
  };
}
