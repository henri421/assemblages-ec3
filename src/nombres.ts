/**
 * Mise en forme des nombres cites dans les messages du noyau.
 *
 * Le noyau n'importe pas `aedificium-ui` : les quelques lignes communes sont
 * recodees ici, avec les memes regles d'affichage — virgule decimale, trois
 * decimales au plus, pas de zeros inutiles. `formaterTaux` reste par ailleurs
 * inchange : c'est une fonction publique, dont le format a trois decimales est
 * celui du noyau.
 */

/** Retire les zeros de fin de partie decimale, puis la virgule restee seule. */
function sansZeros(texte: string): string {
  return texte.includes(',') ? texte.replace(/,?0+$/, '') : texte;
}

/**
 * Nombre tel qu'il s'affiche : trois decimales au plus, sans zeros inutiles.
 * Un NaN ou un infini ne s'affiche jamais comme une valeur : on rend un tiret.
 */
export function nombreAffiche(valeur: number, decimalesMax = 3): string {
  if (!Number.isFinite(valeur)) return '—';
  const texte = valeur.toFixed(Math.min(decimalesMax, 3)).replace('.', ',');
  const propre = /^-0(,0*)?$/.test(texte) ? texte.slice(1) : texte;
  return sansZeros(propre);
}

/**
 * Taux tel qu'il s'affiche : meme arrondi VERS LE VERDICT que `formaterTaux`,
 * puis sans zeros inutiles.
 */
export function tauxAffiche(taux: number): string {
  if (!Number.isFinite(taux)) return 'hors domaine';
  if (taux === 1) return '1';
  const arrondi = taux < 1 ? Math.floor(taux * 1000) / 1000 : Math.ceil(taux * 1000) / 1000;
  return nombreAffiche(arrondi, 3);
}
