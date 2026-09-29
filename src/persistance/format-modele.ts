/**
 * Format de fichier des modeles enregistres.
 *
 * Un fichier JSON porte son format, sa version et le type de detail qu il
 * decrit. Rien ne quitte le navigateur : l enregistrement est un
 * telechargement, la relecture un choix de fichier local.
 */

import type { DonneesAssemblage } from '../domaines/verifier-assemblage';

export const FORMAT = 'assemblages-ec3';
export const VERSION = 1;

export type TypeDetail = 'chaise-ancrage';

export interface FichierModele {
  format: typeof FORMAT;
  version: typeof VERSION;
  detail: TypeDetail;
  donnees: DonneesAssemblage;
}

/** Texte JSON d un modele, indente pour rester lisible dans un gestionnaire de versions. */
export function serialiser(detail: TypeDetail, donnees: DonneesAssemblage): string {
  const fichier: FichierModele = { format: FORMAT, version: VERSION, detail, donnees };
  return `${JSON.stringify(fichier, null, 2)}\n`;
}
