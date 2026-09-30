/**
 * Les sorties : ce qui fait quitter la page a ce qu'elle calcule.
 *
 * Tout ici est PUR — aucune API de navigateur. Le telechargement vit dans
 * `storage.ts`. Aucune dependance : ni generateur de PDF, ni gabarits ; le
 * navigateur imprime deja tres bien du HTML.
 */

import type { Bloc } from './view';
import { echapper } from './format';

/**
 * Les jetons de l'identite graphique, embarques dans les documents exportes.
 * Copie du `:root` de `style.css` : un document exporte ne voit pas la
 * feuille de la page. Toute evolution du `:root` doit etre reportee ici.
 */
export const JETONS = `:root {
  --fond: #f7f7f6;
  --surface: #ffffff;
  --surface-appui: #f2f1ec;
  --texte: #1a1a1a;
  --texte-doux: #4a4842;
  --texte-faible: #6a6862;
  --bordure: #c8c6c0;
  --bordure-douce: #eceae4;
  --accent: #1e5aa8;
  --accent-doux: #eaf1f9;
  --compression: #2f5d8a;
  --traction: #a8442a;
  --beton: #e7eaee;
  --neutre: #9a978f;
  --ok: #1f6f3f;      --ok-fond: #eaf4ee;
  --alerte: #8a6d00;  --alerte-fond: #fdf6e3;
  --refus: #a52121;   --refus-fond: #f8ecec;
  --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --rayon: 4px;
  --rayon-petit: 3px;
  color-scheme: light;
}`;

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

const DECLARATION_XML = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE_SVG = 'http://www.w3.org/2000/svg';

/** Les styles voyagent dans un CDATA : ils contiennent des `>` et des `&`. */
function baliseStyle(styles: string): string {
  return `<style type="text/css"><![CDATA[\n${styles}\n]]></style>`;
}

/** Enveloppe un SVG de la page dans un document autonome, styles INLINES. */
export function svgAutonome(svg: string, styles: string = STYLES_TRACE): string {
  const debut = /<svg\b[^>]*>/i.exec(svg);
  const fin = svg.lastIndexOf('</svg>');
  if (debut === null || fin < debut.index) {
    return `${DECLARATION_XML}\n<svg xmlns="${NAMESPACE_SVG}">${baliseStyle(styles)}</svg>`;
  }
  const ouverture = /\bxmlns\s*=/.test(debut[0])
    ? debut[0]
    : debut[0].replace(/^<svg\b/i, `<svg xmlns="${NAMESPACE_SVG}"`);
  return `${DECLARATION_XML}\n${ouverture}${baliseStyle(styles)}${svg.slice(debut.index + debut[0].length, fin)}</svg>`;
}

// --- CSV ---------------------------------------------------------------------

/** Point-virgule : la virgule est deja le separateur decimal. */
const SEPARATEUR = ';';
const FIN_DE_LIGNE = '\r\n';
/** Marque d'ordre des octets : sans elle, un tableur massacre accents et lettres grecques. */
const BOM = '﻿';

function champCsv(valeur: string): string {
  if (!/[;"\r\n]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/**
 * Les resultats en tableau. AUCUN BLOC N'EST OMIS : ce qui n'a pas ete
 * calcule sort avec son motif.
 */
export function resultatsEnCsv(blocs: readonly Bloc[]): string {
  const lignes = [['Bloc', 'Symbole', 'Grandeur', 'Valeur'].join(SEPARATEUR)];
  for (const b of blocs) {
    for (const l of b.lignes) lignes.push([b.titre, l.symbole, l.libelle, l.valeur].map(champCsv).join(SEPARATEUR));
    if (b.note !== null) lignes.push([b.titre, '', b.note, ''].map(champCsv).join(SEPARATEUR));
  }
  return BOM + lignes.join(FIN_DE_LIGNE) + FIN_DE_LIGNE;
}

// --- Note de calcul ------------------------------------------------------------

export interface NoteDeCalcul {
  titre: string;
  date: string;
  entrees: Bloc[];
  /** SVG deja produits par la page, avec leur legende. */
  dessins: Array<{ titre: string; svg: string; legende: string }>;
  /** Verdict et motif, verbatim. */
  verdict: string;
  motif: string;
  /** Tableaux deja rendus (taux, cordons, dispositions). */
  tableaux: Array<{ titre: string; html: string }>;
  resultats: Bloc[];
  avertissements: string[];
  hypotheses: string[];
}

export const AIDE_AU_CALCUL =
  "Aide au calcul. Cet outil constate, il ne prescrit pas. Les resultats relevent de la responsabilite " +
  "de l'ingenieur qui les emploie et doivent etre verifies. Les valeurs sont celles recommandees par " +
  "l'EN 1993 ; une annexe nationale peut les modifier. L'EN 1993-1-8:2024, deuxieme generation, est " +
  "publiee mais n'est pas encore applicable dans l'attente de son annexe nationale : la transposition " +
  "est prevue au plus tard en septembre 2027 et le retrait des normes conflictuelles au plus tard en mars 2028.";

const STYLE_NOTE = `
  body { margin: 0; padding: 24px 28px; background: var(--surface); color: var(--texte); font: 13px/1.5 var(--sans); }
  h1 { font-size: 1.1rem; font-weight: normal; margin: 0 0 .2rem; }
  h2 { font-size: .95rem; font-weight: 600; margin: 1.5rem 0 .5rem; border-bottom: 1px solid var(--bordure); padding-bottom: .25rem; }
  h3 { font-size: .82rem; font-weight: 600; margin: 1rem 0 .35rem; }
  .date { color: var(--texte-faible); font-size: .8rem; margin: 0 0 1rem; }
  table { border-collapse: collapse; width: 100%; margin: .3rem 0 .6rem; }
  td, th { border-bottom: 1px solid var(--bordure-douce); padding: .22rem .4rem; vertical-align: top; text-align: left; font-weight: normal; }
  thead th { background: var(--surface-appui); font-size: .75rem; }
  td.sym { font-family: var(--mono); width: 9rem; background: var(--surface-appui); }
  td.lib { color: var(--texte-doux); }
  td.val { font-family: var(--mono); text-align: right; white-space: nowrap; }
  .verdict { font-weight: 600; font-size: 1rem; margin: .5rem 0 .2rem; }
  .note, .motif { color: var(--texte-doux); font-size: .8rem; margin: .2rem 0 .8rem; }
  .avertissement { border-left: 3px solid var(--alerte); background: var(--alerte-fond); color: var(--alerte);
                   padding: .5rem .7rem; border-radius: var(--rayon); margin: .5rem 0; font-size: .82rem; }
  .dessin-note { margin: .6rem 0 1rem; page-break-inside: avoid; }
  .dessin-note svg { max-width: 100%; max-height: 90mm; height: auto; display: block; }
  .jauge { display: none; }
  .pied { margin-top: 2rem; padding-top: .6rem; border-top: 1px solid var(--bordure); color: var(--texte-doux); font-size: .78rem; }
  ul { margin: .3rem 0 .6rem; padding-left: 1.1rem; color: var(--texte-doux); font-size: .82rem; }
  @media print { body { padding: 0; } h2 { page-break-after: avoid; } }
`;

function tableDuBloc(b: Bloc): string {
  const lignes = b.lignes
    .map(
      (l) =>
        `<tr><td class="sym">${echapper(l.symbole)}</td><td class="lib">${echapper(l.libelle)}</td>` +
        `<td class="val">${echapper(l.valeur)}</td></tr>`,
    )
    .join('');
  const note = b.note === null ? '' : `<p class="note">${echapper(b.note)}</p>`;
  return `<h3>${echapper(b.titre)}</h3>${lignes === '' ? '' : `<table>${lignes}</table>`}${note}`;
}

/**
 * La note de calcul : un document HTML AUTONOME, imprimable en PDF.
 *
 * Elle porte les valeurs INTERMEDIAIRES et pas seulement les resultats : un
 * taux sans ses contraintes et ses limites n'est pas verifiable par un tiers.
 * Elle ne masque AUCUNE verification non applicable : ce qui n'a pas ete
 * calcule y figure avec son motif. C'est un compte rendu, pas une
 * justification reglementaire signee.
 */
export function noteDeCalculHtml(note: NoteDeCalcul, styles: string = STYLES_TRACE): string {
  const avertissements = note.avertissements.map((a) => `<p class="avertissement">${echapper(a)}</p>`).join('');
  const dessins = note.dessins
    .map((d) => `<div class="dessin-note"><h3>${echapper(d.titre)}</h3>${d.svg}<p class="note">${echapper(d.legende)}</p></div>`)
    .join('');
  const tableaux = note.tableaux.map((t) => `<h3>${echapper(t.titre)}</h3>${t.html}`).join('');
  const hypotheses =
    note.hypotheses.length === 0
      ? ''
      : `<h2>Hypotheses et limites</h2><ul>${note.hypotheses.map((h) => `<li>${echapper(h)}</li>`).join('')}</ul>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Note de calcul — ${echapper(note.titre)}</title>
<style>${styles}${STYLE_NOTE}</style></head>
<body>
<h1>Note de calcul — ${echapper(note.titre)} (EN 1993-1-8:2005)</h1>
<p class="date">${echapper(note.date)}</p>
${avertissements}
<h2>Donnees d'entree</h2>${note.entrees.map(tableDuBloc).join('')}
<h2>Geometrie</h2>${dessins}
<h2>Verdict</h2><p class="verdict">${echapper(note.verdict)}</p><p class="motif">${echapper(note.motif)}</p>
<h2>Verifications</h2>${tableaux}
<h2>Grandeurs du calcul</h2>${note.resultats.map(tableDuBloc).join('')}
${hypotheses}
<p class="pied">${echapper(AIDE_AU_CALCUL)} Cette note est un compte rendu, pas une justification reglementaire signee.</p>
</body></html>`;
}
