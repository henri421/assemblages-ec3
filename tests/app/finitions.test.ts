/**
 * Tests d'acceptation de l'etape 8.2 (finitions) : notations, arrondis,
 * accents, titre, phrases types, sur le texte VISIBLE (formulaire, ecran,
 * dessins, note, CSV, page). Le controle lui-meme vit dans aedificium-ui
 * (`constatsAffichage`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMS_GRECS, blocsEnTexte, constatsAffichage, contenuBalise, notationHtml, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { FORMULAIRES, OUTILS, lireSaisie, valeursParDefaut } from '../../app/src/form';
import { assistance, calculer } from '../../app/src/calcul';
import { blocsDuCalcul, htmlAssistance, rendreResultat } from '../../app/src/view';
import { dessinsDuCalcul } from '../../app/src/draw';
import { avertissements, hypotheses } from '../../app/src/hypotheses';
import { STYLES_TRACE, resultatsEnCsv } from '../../app/src/export';
import { blocsDEntree, noteDuCalcul } from '../../app/src/sorties';

const TITRE = 'Assemblages en acier';
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html)).map((c) => `${nom} : ${c}`);

function sorties() {
  const formulaire: string[] = [];
  const ecran: string[] = [];
  const notes: string[] = [];
  const csv: string[] = [];
  for (const o of OUTILS) {
    formulaire.push(o.nom, o.description, ...hypotheses(o.id));
    for (const g of FORMULAIRES[o.id]) {
      formulaire.push(g.titre);
      for (const c of g.champs) formulaire.push(`${c.libelle} ${c.unite}`, ...(c.options ?? []).map(([, l]) => l));
    }
    const v = valeursParDefaut(o.id);
    const lecture = lireSaisie(o.id, v);
    if (!lecture.ok) throw new Error(`${o.id} : ${lecture.message}`);
    const c = calculer(lecture.modele);
    ecran.push(
      htmlAssistance(assistance(lecture.modele)),
      rendreResultat(c),
      ...dessinsDuCalcul(c).flatMap((d) => [d.titre, d.svg, d.legende]),
      ...avertissements(c).map((a) => notationHtml(a))
    );
    notes.push(noteDeCalculHtml(noteDuCalcul(o.id, v, c, { projet: 'Projet', element: '', date: '2026-10-24' }), STYLES_TRACE));
    csv.push(resultatsEnCsv(blocsEnTexte([...blocsDEntree(o.id, v), ...blocsDuCalcul(c)])));
  }
  return { formulaire, ecran, notes, csv };
}

describe('texte visible : notations, arrondis, accents, phrases types', () => {
  const s = sorties();

  it('formulaires, noms des details et hypotheses', () => {
    expect(s.formulaire.flatMap((h, i) => controler(`formulaire ${i}`, h))).toEqual([]);
  });

  it('ecran et dessins', () => {
    expect(s.ecran.flatMap((h, i) => controler(`ecran ${i}`, h))).toEqual([]);
  });

  it('note de calcul', () => {
    expect(s.notes.flatMap((h, i) => controler(`note ${i}`, h))).toEqual([]);
  });

  it('page (index.html)', () => {
    expect(controler('page', lire('../../app/index.html'))).toEqual([]);
  });

  it('CSV : texte brut, ni « _ » ni nom de lettre grecque ni balise', () => {
    for (const c of s.csv) {
      expect(c).not.toContain('_');
      expect(c).not.toMatch(NOMS_GRECS);
      expect(c).not.toContain('<');
    }
  });
});

describe('titre', () => {
  const page = lire('../../app/index.html');

  it('titre de la page sans tiret, majuscule initiale', () => {
    expect(contenuBalise(page, 'h1')).toBe(TITRE);
    expect(contenuBalise(page, 'title')?.startsWith(TITRE)).toBe(true);
  });

  it('titre en grand', () => {
    const regle = /(^|\n)h1\s*\{([^}]*)\}/.exec(lire('../../app/src/style.css'))?.[2] ?? '';
    expect(regle).toMatch(/font-size:\s*1\.75rem/);
    expect(regle).toMatch(/font-weight:\s*600/);
  });
});

describe('main.ts passe par les fonctions testees', () => {
  it('note et CSV', () => {
    const main = lire('../../app/src/main.ts');
    expect(main).toContain("from './sorties'");
    expect(main).toContain('noteDuCalcul(');
    expect(main).toContain('blocsEnTexte(');
    expect(main).not.toMatch(/function blocsDEntree/);
  });
});
