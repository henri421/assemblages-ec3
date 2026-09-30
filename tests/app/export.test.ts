import { describe, expect, it } from 'vitest';

import { calculer } from '../../app/src/calcul';
import { CLASSES_DE_DESSIN, dessinsDuCalcul } from '../../app/src/draw';
import { STYLES_TRACE, noteDeCalculHtml, resultatsEnCsv, svgAutonome } from '../../app/src/export';
import { OUTILS, lireSaisie, valeursParDefaut } from '../../app/src/form';
import { blocsDuCalcul } from '../../app/src/view';

function calcul(o: (typeof OUTILS)[number]['id'], modif: Record<string, string> = {}) {
  const r = lireSaisie(o, { ...valeursParDefaut(o), ...modif });
  if (!r.ok) throw new Error(r.message);
  return calculer(r.modele);
}

describe('STYLES_TRACE', () => {
  /**
   * Garde-fou : un dessin exporte ne voit pas la feuille de la page. Une
   * classe sans regle ici sortirait en aplat noir.
   */
  it('porte une regle pour chaque classe emise par les dessins', () => {
    for (const classe of CLASSES_DE_DESSIN) {
      if (classe === 'dessin') continue;
      expect(STYLES_TRACE, classe).toMatch(new RegExp(`\\.dessin \\.${classe} \\{`));
    }
  });

  it('les dessins n emettent aucune classe hors de la liste', () => {
    const connues = new Set<string>(CLASSES_DE_DESSIN);
    const cas = [
      ...OUTILS.map((o) => calcul(o.id)),
      calcul('chaise-ancrage', { schema: 'appui-extremites', type_appui: 'lierne-acier' }),
      calcul('te', { type_soudure: 'penetration-partielle' }),
    ];
    for (const c of cas) {
      for (const d of dessinsDuCalcul(c)) {
        for (const m of d.svg.matchAll(/class="([^"]+)"/g)) expect(connues.has(m[1]), m[1]).toBe(true);
      }
    }
  });
});

describe('svgAutonome', () => {
  it('ajoute l espace de noms et les styles', () => {
    const s = svgAutonome(dessinsDuCalcul(calcul('te'))[0].svg);
    expect(s.startsWith('<?xml')).toBe(true);
    expect(s).toMatch(/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(s).toMatch(/CDATA/);
  });
});

describe('resultatsEnCsv', () => {
  it('BOM, point-virgule, aucune ligne omise', () => {
    const blocs = blocsDuCalcul(calcul('chaise-ancrage'));
    const csv = resultatsEnCsv(blocs);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe('Bloc;Symbole;Grandeur;Valeur');
    const nLignes = blocs.reduce((n, b) => n + b.lignes.length + (b.note === null ? 0 : 1), 0);
    expect(csv.trim().split('\r\n')).toHaveLength(nLignes + 1);
  });
});

describe('noteDeCalculHtml', () => {
  it('porte l avertissement de deuxieme generation et les hypotheses', () => {
    const html = noteDeCalculHtml({
      titre: 'x', date: '2026-09-30', entrees: [], dessins: [], verdict: 'Conforme', motif: 'm',
      tableaux: [], resultats: [], avertissements: ['attention'], hypotheses: ['h1'],
    });
    expect(html).toMatch(/2027/);
    expect(html).toMatch(/constate, il ne prescrit pas/);
    expect(html).toMatch(/h1/);
    expect(html).toMatch(/class="avertissement">attention/);
  });
});

describe('jetons communs', () => {
  it('le :root de style.css porte les memes valeurs que JETONS d aedificium-ui', async () => {
    const { readFileSync } = await import('node:fs');
    const { JETONS, valeursDesJetons } = await import('aedificium-ui');
    const css = readFileSync(new URL('../../app/src/style.css', import.meta.url), 'utf8');
    const racine = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')) + 1);
    expect(valeursDesJetons(racine)).toEqual(valeursDesJetons(JETONS));
  });
});
