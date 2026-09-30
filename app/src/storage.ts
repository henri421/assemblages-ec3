/**
 * Le seul point de l'application qui touche au navigateur pour faire entrer
 * ou sortir des donnees : telechargement, lecture d'un fichier local,
 * memoire locale du dernier modele.
 *
 * AUCUNE DONNEE NE QUITTE LE NAVIGATEUR. Les donnees de projet sont couvertes
 * par le secret professionnel : il n'y a ni serveur, ni analytique, ni
 * requete reseau. La memoire locale reste sur le poste.
 */

export { ouvrirOuTelecharger, telecharger } from 'aedificium-ui';

/** Texte d'un fichier choisi par l'utilisateur. */
export function lireFichier(fichier: File): Promise<string> {
  return fichier.text();
}

const CLE = 'assemblages-ec3:dernier-modele';

/**
 * Memorise le dernier modele saisi. La memoire locale peut etre absente
 * (navigation privee, stockage bloque) : on s'en passe sans bruit, la page
 * fonctionne sans elle.
 */
export function memoriser(texte: string): void {
  try {
    localStorage.setItem(CLE, texte);
  } catch {
    // Stockage indisponible : rien a faire.
  }
}

export function relire(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}
