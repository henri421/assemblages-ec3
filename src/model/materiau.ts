/**
 * Materiau des pieces assemblees.
 *
 * Une seule nuance par assemblage : les pieces d une meme tete d ancrage ou
 * d un meme detail soude sont commandees ensemble. La limite elastique depend
 * en revanche de l epaisseur, et se lit piece par piece (voir `norms/acier`).
 */

/** Nuances de l EN 10025, designations courtes. */
export type Nuance = 'S235' | 'S275' | 'S355' | 'S420' | 'S460';

/** Qualite dans le sens de l epaisseur selon l EN 10164. */
export type QualiteZ = 'aucune' | 'Z15' | 'Z25' | 'Z35';

export interface Materiau {
  nuance: Nuance;
  /** Qualite dans le sens de l epaisseur (EN 10164) ; 'aucune' par defaut. */
  qualiteZ: QualiteZ;
}

export const NUANCES: readonly Nuance[] = ['S235', 'S275', 'S355', 'S420', 'S460'];
export const QUALITES_Z: readonly QualiteZ[] = ['aucune', 'Z15', 'Z25', 'Z35'];
