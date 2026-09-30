/**
 * Mise en forme des nombres et du texte. Module PUR.
 */

/** Echappement de tout texte insere dans du HTML ou du SVG. */
export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Nombre a la francaise, virgule decimale.
 *
 * Un NaN ou un infini ne doit JAMAIS atteindre l'ecran : il s'y lirait comme
 * une valeur alors qu'il signale une absence de valeur. On rend un tiret.
 */
export function nombreFr(valeur: number, decimales: number): string {
  if (!Number.isFinite(valeur)) {
    return '—';
  }
  const texte = valeur.toFixed(decimales).replace('.', ',');
  // -0,00 n'a pas de sens a l'ecran.
  return /^-0(,0*)?$/.test(texte) ? texte.slice(1) : texte;
}

/** Nombre avec unite, espace insecable. */
export function avecUnite(valeur: number, decimales: number, unite: string): string {
  return unite === '' ? nombreFr(valeur, decimales) : `${nombreFr(valeur, decimales)} ${unite}`;
}

/**
 * Nombre lu depuis un champ, ou `null`.
 *
 * La virgule decimale est acceptee : c'est ainsi qu'on ecrit une note de
 * calcul. L'infini est refuse : il traverserait sans bruit les tests de
 * finitude du noyau.
 */
export function lireNombre(texte: string): number | null {
  const nettoye = texte.trim().replace(',', '.');
  if (nettoye === '') return null;
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) ? valeur : null;
}
