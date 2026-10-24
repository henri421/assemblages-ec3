/**
 * Les sorties de l'application, en modules PURS : donnees d'entree sous forme
 * de blocs, et contenu de la note de calcul. Aucun acces au document.
 *
 * `main.ts` ne fait plus que le branchement : il passe l'outil et les valeurs
 * a ces fonctions, ce qui rend les sorties testables sans navigateur.
 */

import { notationHtml } from 'aedificium-ui';
import { OUTILS, estVisible, FORMULAIRES, type Outil, type Valeurs } from './form';
import { dessinsDuCalcul } from './draw';
import { avertissements, hypotheses } from './hypotheses';
import type { NoteDeCalcul } from './export';
import {
  blocsDuCalcul,
  htmlConstats,
  htmlCordons,
  htmlDispositions,
  htmlTaux,
  noteMethodes,
  titreDuVerdict,
  titreOrganes,
  type Bloc,
} from './view';
import type { Calcul } from './calcul';

/** Entites HTML courantes des libelles de formulaire, en texte brut. */
const ENTITES: Readonly<Record<string, string>> = {
  '&gamma;': 'γ',
  '&perp;': '⊥',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
};

/** Libelle de formulaire en texte brut : balises retirees, entites decodees. */
function libelleEnTexte(libelle: string): string {
  return libelle
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, (entite) => ENTITES[entite] ?? '')
    .trim();
}

/**
 * Les donnees d'entree, telles que saisies, sous forme de blocs. Les champs
 * masques ne figurent pas : ce qui n'est pas lu n'est pas une entree.
 */
export function blocsDEntree(outil: Outil, v: Valeurs): Bloc[] {
  return FORMULAIRES[outil]
    .map((g) => ({
      titre: g.titre,
      lignes: g.champs
        .filter((c) => estVisible(g, c, v))
        .map((c) => ({
          symbole: c.cle,
          libelle: libelleEnTexte(c.libelle),
          valeur:
            c.type === 'case'
              ? v[c.cle] === 'oui'
                ? 'oui'
                : 'non'
              : c.type === 'choix'
                ? (c.options?.find(([val]) => val === v[c.cle])?.[1] ?? v[c.cle] ?? '')
                : (v[c.cle] ?? '') === ''
                  ? 'non saisi'
                  : `${v[c.cle]}${c.unite === '' || c.unite === '-' ? '' : ` ${c.unite}`}`,
        })),
      note: null,
    }))
    .filter((b) => b.lignes.length > 0);
}

/**
 * Le contenu de la note de calcul, sans le rendu HTML. Les meme elements, dans
 * le meme ordre, que `rendreResultat` a l'ecran : constats, taux, cordons ou
 * boulons et dispositions.
 */
export function noteDuCalcul(outil: Outil, v: Valeurs, c: Calcul, date: string): NoteDeCalcul {
  const nom = OUTILS.find((o) => o.id === outil)?.nom ?? outil;
  return {
    titre: nom,
    date,
    entrees: blocsDEntree(outil, v),
    dessins: dessinsDuCalcul(c),
    verdict: titreDuVerdict(c.resultat.verdict),
    motif: c.resultat.motif,
    tableaux: [
      { titre: 'Constats', html: htmlConstats(c) },
      { titre: 'Taux de travail', html: htmlTaux(c.resultat.taux) },
      { titre: titreOrganes(c), html: `${htmlCordons(c)}<p class="note">${notationHtml(noteMethodes(c))}</p>` },
      { titre: 'Dispositions constructives', html: htmlDispositions(c.resultat.dispositions) },
    ],
    resultats: blocsDuCalcul(c),
    avertissements: avertissements(c),
    hypotheses: hypotheses(outil),
  };
}
