/**
 * Aiguillage du calcul selon le type de detail. Module PUR.
 */

import {
  REGLES_CHAISE,
  verifierAssemblage,
  verifierDispositions,
  verifierProfilePlatine,
  verifierRecouvrement,
  verifierTe,
  type Modele,
  type ResultatAssemblage,
  type ResultatDispositions,
  type ResultatProfile,
  type ResultatRecouvrement,
  type ResultatTe,
} from '../../src/index';

export type Calcul =
  | { detail: 'chaise-ancrage'; modele: Extract<Modele, { detail: 'chaise-ancrage' }>; resultat: ResultatAssemblage }
  | { detail: 'te'; modele: Extract<Modele, { detail: 'te' }>; resultat: ResultatTe }
  | { detail: 'recouvrement'; modele: Extract<Modele, { detail: 'recouvrement' }>; resultat: ResultatRecouvrement }
  | { detail: 'profile-platine'; modele: Extract<Modele, { detail: 'profile-platine' }>; resultat: ResultatProfile };

/** Calcul complet ; leve si le noyau refuse les donnees. */
export function calculer(modele: Modele): Calcul {
  switch (modele.detail) {
    case 'chaise-ancrage':
      return { detail: modele.detail, modele, resultat: verifierAssemblage(modele.donnees) };
    case 'te':
      return { detail: modele.detail, modele, resultat: verifierTe(modele.donnees) };
    case 'recouvrement':
      return { detail: modele.detail, modele, resultat: verifierRecouvrement(modele.donnees) };
    case 'profile-platine':
      return { detail: modele.detail, modele, resultat: verifierProfilePlatine(modele.donnees) };
  }
}

/**
 * Assistance a la saisie : les dispositions constructives de la tete
 * d'ancrage, evaluees par LE MEME moteur que le tableau formel, mais sans
 * attendre que le calcul complet aboutisse. Une saisie qui fait echouer le
 * calcul peut ainsi etre deja signalee comme irreguliere.
 *
 * Pour les details types, les dispositions sont rendues avec le resultat.
 */
export function assistance(modele: Modele): ResultatDispositions | null {
  if (modele.detail !== 'chaise-ancrage') return null;
  const { assemblage, materiau } = modele.donnees;
  return verifierDispositions(REGLES_CHAISE, { assemblage, materiau });
}
