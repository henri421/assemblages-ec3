/**
 * Les sorties de l'application, en modules PURS : donnees d'entree sous forme
 * de blocs, et contenu de la note de calcul. Aucun acces au document.
 *
 * `main.ts` ne fait plus que le branchement : il passe l'outil et les valeurs
 * a ces fonctions, ce qui rend les sorties testables sans navigateur.
 */

import type { ElementNote, NoteDeCalcul, VerificationNote } from 'aedificium-ui';
import { accentue } from './accents';
import { trNote } from './textes';
import { OUTILS, estVisible, FORMULAIRES, type Outil, type Valeurs } from './form';
import { dessinsDuCalcul } from './draw';
import { avertissements, hypotheses } from './hypotheses';
import {
  blocsDuCalcul,
  noteMethodes,
  tableauDispositions,
  tableauOrganes,
  texteOrganes,
  type Bloc,
} from './view';
import type { Calcul } from './calcul';
import { VERSION_OUTIL } from './version';
import { lireAnnexe, traduireSource } from 'aedificium-ui';
import { COEFS, avertissementDeLAnnexe, profilDeCalcul, type Coefs, type ProfilAnnexe } from './annexe';
import { lireNombre } from './format';

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

/** Section de la note ou range un groupe de saisie, d apres son titre. */
function sectionDuGroupe(titre: string): 'geometrie' | 'materiaux' | 'hypotheses' | 'charges' {
  if (/^(Matériau|Soudage)/.test(titre)) return 'materiaux';
  if (titre === 'Coefficients') return 'hypotheses';
  if (/^(Actions|Sollicitation)/.test(titre)) return 'charges';
  return 'geometrie';
}

/** Un bloc de l application en bloc de la note, textes accentues. */
function enBloc(b: Bloc): ElementNote {
  return {
    type: 'bloc',
    bloc: {
      titre: accentue(b.titre),
      lignes: b.lignes.map((l) => ({ symbole: accentue(l.symbole), libelle: accentue(l.libelle), valeur: accentue(l.valeur) })),
      note: b.note === null ? null : accentue(b.note),
    },
  };
}

/** Un tableau en element de la note, cellules accentuees. */
function enTableau(t: { titre: string; entetes: string[]; lignes: string[][] }): ElementNote {
  return { type: 'tableau', titre: t.titre, entetes: t.entetes, lignes: t.lignes.map((l) => l.map(accentue)) };
}

/** Coefficients saisis, lus du formulaire ; un champ masque ou vide reste absent. */
function coefsDeValeurs(v: Valeurs): Coefs {
  const c: Coefs = {};
  for (const k of COEFS) {
    const x = lireNombre(v[k] ?? '');
    if (x !== null) c[k] = x;
  }
  return c;
}

/** Bloc des coefficients : chaque ligne porte la source de sa valeur, traduite a la sortie. */
function blocCoefficients(b: Bloc, profil: ProfilAnnexe): Bloc {
  return {
    ...b,
    lignes: b.lignes.map((l) => {
      const cle = COEFS.find((k) => k === l.symbole);
      return cle === undefined ? l : { ...l, libelle: `${l.libelle} : ${traduireSource(profil.valeurs[cle].source)}` };
    }),
  };
}

/**
 * La note de calcul, rangee dans les sections de la note commune
 * d aedificium-ui. Aucun verdict global : les conclusions sont le tableau des
 * taux, que la note commune construit depuis `verifications`.
 */
export function noteDuCalcul(
  outil: Outil,
  v: Valeurs,
  c: Calcul,
  cartouche: { projet: string; element: string; date: string },
): NoteDeCalcul {
  const nom = OUTILS.find((o) => o.id === outil)?.nom ?? outil;
  const s = {
    geometrie: [] as ElementNote[],
    materiaux: [] as ElementNote[],
    hypotheses: [{ type: 'liste', items: hypotheses(outil).map(accentue) }] as ElementNote[],
    charges: [] as ElementNote[],
    calculs: blocsDuCalcul(c).map(enBloc),
  };
  const annexe = lireAnnexe(v.annexe);
  const profil = profilDeCalcul(annexe, coefsDeValeurs(v));
  for (const b of blocsDEntree(outil, v)) s[sectionDuGroupe(b.titre)].push(enBloc(b.titre === 'Coefficients' ? blocCoefficients(b, profil) : b));
  for (const d of dessinsDuCalcul(c)) s.geometrie.push({ type: 'figure', svg: d.svg, legende: `${d.titre} : ${accentue(d.legende)}` });

  const organes = tableauOrganes(c);
  if (organes !== null) s.calculs.push(enTableau(organes));
  const precision = texteOrganes(c);
  if (precision !== null) s.calculs.push({ type: 'texte', texte: precision });
  s.calculs.push({ type: 'texte', texte: accentue(noteMethodes(c)) });

  // Un mecanisme sans objet n est pas une verification : il reste visible ici, avec son motif.
  const sansObjet = c.resultat.taux.filter((t) => !t.applicable);
  if (sansObjet.length > 0) {
    s.calculs.push({
      type: 'liste',
      items: sansObjet.map((t) => `${accentue(t.libelle)} (${t.clause}) : sans objet, ${accentue(t.notApplicableReason ?? '')}`),
    });
  }
  s.calculs.push(enTableau(tableauDispositions(c.resultat.dispositions)));

  const verifications: VerificationNote[] = [
    ...c.resultat.taux
      .filter((t) => t.applicable)
      .map((t) => ({
        nom: accentue(t.libelle) + (t.famille === 'service' ? ' (service)' : ''),
        clause: accentue(t.clause),
        taux: t.valeur,
        ok: t.valeur <= 1,
      })),
    // Les regles bloquantes jugent sans ratio ; les autres restent au tableau des dispositions.
    ...c.resultat.dispositions.constats
      .filter((r) => r.applicable && r.severite === 'bloquante')
      .map((r) => ({ nom: accentue(r.enonce), clause: accentue(r.clause), taux: null, ok: r.satisfaite })),
  ];

  const element = cartouche.element.trim();
  const lu = annexe === 'lu';
  // En anglais (lot 8.8), la note est traduite ici, avant sa mise en HTML.
  const note = trNote({
    cartouche: {
      version: VERSION_OUTIL,
      projet: cartouche.projet,
      element: element === '' ? nom : element,
      date: cartouche.date,
      norme: lu ? 'EN 1993-1-8:2005, ILNAS-EN 1993-1-8/AN-LU:2020' : 'EN 1993-1-8:2005',
      outil: 'assemblages-ec3',
    },
    sections: s,
    verifications,
    avertissements: avertissements(c).map(accentue),
  });
  // L'avertissement de l'annexe luxembourgeoise est en tete ; il est deja dans la langue de la sortie.
  const aviso = avertissementDeLAnnexe(annexe);
  return aviso === '' ? note : { ...note, avertissements: [aviso, ...note.avertissements] };
}
