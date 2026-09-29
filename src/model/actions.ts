/**
 * Actions sur une tete d ancrage de tirant.
 *
 * Unites : efforts en kN.
 */

export interface Actions {
  /** Effort ELU issu du calcul de la paroi (kN). */
  N_ELU: number;
  /** Traction d epreuve de l essai de reception (kN). */
  P_p?: number;
  /** Resistance caracteristique de l armature (kN). */
  F_tk?: number;
  /** Traction de blocage (kN), pour le critere de service. */
  P_blocage?: number;
}
