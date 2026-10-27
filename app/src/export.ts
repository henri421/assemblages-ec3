/**
 * Les sorties : ce qui fait quitter la page a ce qu'elle calcule.
 *
 * Tout ici est PUR — aucune API de navigateur. Le telechargement vit dans
 * `storage.ts`. Aucune dependance : ni generateur de PDF, ni gabarits ; le
 * navigateur imprime deja tres bien du HTML.
 */

import {
  JETONS,
  resultatsEnCsv as resultatsEnCsvCommun,
  svgAutonome as svgAutonomeCommun,
} from 'aedificium-ui';

import type { Bloc } from './view';

export { JETONS };

/**
 * Les regles de PEINTURE des dessins, jetons compris.
 *
 * `JETONS` definit les couleurs mais n'en applique aucune. Sans ces regles,
 * chaque forme d'un SVG exporte retomberait sur les defauts SVG (`fill:
 * black`, `stroke: none`) et le dessin sortirait en aplat noir. Elles sont
 * recopiees VERBATIM de `style.css`, et un test exige une regle pour chaque
 * classe emise par `draw.ts`.
 */
export const STYLES_TRACE = `${JETONS}

svg { background: var(--surface); color-scheme: light; font-family: var(--sans); }
.dessin * { vector-effect: non-scaling-stroke; }
.dessin .acier { fill: var(--surface-appui); stroke: var(--texte); stroke-width: 1; }
.dessin .acier-coupe { fill: var(--neutre); stroke: var(--texte); stroke-width: 1.2; }
.dessin .beton { fill: var(--beton); stroke: var(--neutre); stroke-width: 1; }
.dessin .soudure { fill: var(--texte); stroke: none; }
.dessin .cordon { fill: none; stroke: var(--texte); stroke-width: 4; }
.dessin .percage { fill: var(--surface); stroke: var(--texte); stroke-width: 1; }
.dessin .couronne { fill: none; stroke: var(--compression); stroke-width: 2.5; }
.dessin .bloc { fill: var(--surface); stroke: var(--compression); stroke-width: 1.5; }
.dessin .diffusion { fill: none; stroke: var(--accent); stroke-width: 1.2; stroke-dasharray: 5 4; }
.dessin .contour-c { fill: var(--accent-doux); stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 7 5; }
.dessin .axe { fill: none; stroke: var(--neutre); stroke-width: 1; stroke-dasharray: 10 3 2 3; }
.dessin .appui { fill: none; stroke: var(--texte); stroke-width: 3; }
.dessin .charge { fill: var(--texte); stroke: var(--texte); stroke-width: 2; }`;

/** Enveloppe un dessin de la page dans un SVG autonome, styles de trace inlines. */
export function svgAutonome(svg: string, styles: string = STYLES_TRACE): string {
  return svgAutonomeCommun(svg, styles);
}

/** Les resultats en CSV (point-virgule, BOM, aucun bloc omis). */
export function resultatsEnCsv(blocs: readonly Bloc[]): string {
  return resultatsEnCsvCommun(blocs);
}
