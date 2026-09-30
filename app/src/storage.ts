/**
 * Le seul point de l'application qui touche au navigateur pour faire entrer
 * ou sortir des donnees : telechargement, lecture d'un fichier local,
 * memoire locale du dernier modele.
 *
 * AUCUNE DONNEE NE QUITTE LE NAVIGATEUR. Les donnees de projet sont couvertes
 * par le secret professionnel : il n'y a ni serveur, ni analytique, ni
 * requete reseau. La memoire locale reste sur le poste.
 */

export function telecharger(nomFichier: string, contenu: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

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
