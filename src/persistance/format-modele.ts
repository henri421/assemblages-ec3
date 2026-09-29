/**
 * Format de fichier des modeles enregistres.
 *
 * Un fichier JSON porte son format, sa version et le type de detail qu il
 * decrit. Rien ne quitte le navigateur : l enregistrement est un
 * telechargement, la relecture un choix de fichier local.
 */

import type { DonneesProfile } from '../details/profile-platine';
import type { DonneesRecouvrement } from '../details/recouvrement';
import type { DonneesTe } from '../details/te';
import type { DonneesAssemblage } from '../domaines/verifier-assemblage';

export const FORMAT = 'assemblages-ec3';
export const VERSION = 1;

/** Un modele, discrimine par son type de detail. */
export type Modele =
  | { detail: 'chaise-ancrage'; donnees: DonneesAssemblage }
  | { detail: 'te'; donnees: DonneesTe }
  | { detail: 'recouvrement'; donnees: DonneesRecouvrement }
  | { detail: 'profile-platine'; donnees: DonneesProfile };

export type TypeDetail = Modele['detail'];

export type FichierModele = { format: typeof FORMAT; version: typeof VERSION } & Modele;

/** Texte JSON d un modele, indente pour rester lisible dans un gestionnaire de versions. */
export function serialiser(modele: Modele): string {
  const fichier = { format: FORMAT, version: VERSION, ...modele };
  return `${JSON.stringify(fichier, null, 2)}\n`;
}
