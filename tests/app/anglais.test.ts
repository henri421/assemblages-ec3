/**
 * Version anglaise (lot 8.8) : page `en/index.html` de meme squelette que la
 * page francaise, et AUCUN reste de francais dans ce qui s'affiche en anglais.
 * Chaque sortie passe par les memes traducteurs que main.ts. Chaque detail est
 * rendu avec ses valeurs de depart, puis avec chaque option de chaque liste et
 * chaque case basculee. Le francais est couvert par les autres tests, inchanges.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blocsEnTexte, constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { notationHtml, notationTexte } from '../../app/src/accents';
import { assistance, calculer } from '../../app/src/calcul';
import { dessinsDuCalcul } from '../../app/src/draw';
import { STYLES_TRACE, resultatsEnCsv } from '../../app/src/export';
import { FORMULAIRES, OUTILS, lireSaisie, valeursParDefaut, type Outil, type Valeurs } from '../../app/src/form';
import { avertissements, hypotheses } from '../../app/src/hypotheses';
import { blocsDEntree, noteDuCalcul } from '../../app/src/sorties';
import { blocsDuCalcul, htmlAssistance, messageDErreur, rendreResultat } from '../../app/src/view';
import { tr, trBlocs, trHtml } from '../../app/src/textes';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
/** Mots francais sans accent : le controle commun ne les voit pas (le noyau ecrit sans accents). */
const MOTS_FR =
  /(?<![\p{L}'])(de|la|le|les|du|des|et|pour|sur|par|une|est|avec|sans|aux|au|ou|dans|selon|entre|ne|pas|plat|plats|platine|cordon|cordons|gorge|soudure|boulon|boulons|effort|fois|sous|recouvrement|assemblage|court|attache|piece|vue|coupe|ame|ames)(?![\p{L}'])/iu;
const motsFrancais = (texte: string): string[] =>
  texte
    .split(/\n|\s*\|\s*|(?<=[.:;])\s/)
    .filter((l) => MOTS_FR.test(l))
    .map((l) => `mot francais sans accent : « ${l.trim().slice(0, 120)} »`);
const controler = (nom: string, html: string): string[] =>
  [...constatsAffichage(texteVisible(html), { langue: 'en' }), ...motsFrancais(texteVisible(html).replace(/Version française/g, ''))].map((c) => `${nom} : ${c}`);
/** CSV : la virgule y est le separateur, pas une virgule decimale. */
const controlerCsv = (nom: string, csv: string): string[] =>
  [...constatsAffichage(csv, { langue: 'en' }), ...motsFrancais(csv.split(/[\n,]/).join('\n'))]
    .filter((c) => !c.startsWith('virgule decimale'))
    .map((c) => `${nom} : ${c}`);

/** Squelette d'une page : les attributs que lit le script, dans l'ordre. */
function squelette(html: string): string[] {
  return [...html.matchAll(/\s(id|data-[a-z-]+|type|inputmode|accept|value)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
}

/** Le formulaire d'un detail, construit comme main.ts. */
function formulaireHtml(outil: Outil): string {
  return FORMULAIRES[outil]
    .map((g) => {
      const champs = g.champs
        .map((c) => {
          if (c.type === 'case') return `<label><span>${c.libelle}</span></label>`;
          const unite = c.unite === '' || c.unite === '-' ? '' : ` (${c.unite})`;
          const options = (c.options ?? []).map(([, lib]) => `<option>${notationTexte(lib)}</option>`).join('');
          return `<label><span>${c.libelle}${unite}</span>${c.type === 'choix' ? `<select>${options}</select>` : `<input${c.facultatif ? ' placeholder="facultatif"' : ''} />`}</label>`;
        })
        .join('');
      return `<fieldset><legend>${notationHtml(g.titre)}</legend>${champs}</fieldset>`;
    })
    .join('');
}

/** Valeurs de depart, puis une variante par option de liste et par case. */
function variantes(outil: Outil): Valeurs[] {
  const d = valeursParDefaut(outil);
  const liste: Valeurs[] = [d];
  for (const g of FORMULAIRES[outil]) {
    for (const c of g.champs) {
      if (c.type === 'choix') for (const [val] of c.options ?? []) if (val !== d[c.cle]) liste.push({ ...d, [c.cle]: val });
      if (c.type === 'case') liste.push({ ...d, [c.cle]: d[c.cle] === 'oui' ? 'non' : 'oui' });
    }
  }
  return liste;
}

/** Tout ce qui s'affiche pour une saisie : ecran, note, CSV. */
function sorties(outil: Outil, v: Valeurs): { ecran: string[]; note: string; csv: string } | { erreur: string } {
  const lecture = lireSaisie(outil, v);
  if (!lecture.ok) return { erreur: tr(notationTexte(lecture.message)) };
  let c: ReturnType<typeof calculer>;
  try {
    c = calculer(lecture.modele);
  } catch (e) {
    return { erreur: tr(notationTexte(messageDErreur(e))) };
  }
  let aide: ReturnType<typeof assistance> | null = null;
  try {
    aide = assistance(lecture.modele);
  } catch {
    aide = null;
  }
  const ecran = [
    htmlAssistance(aide),
    ...dessinsDuCalcul(c).map((d) => `<figure><figcaption>${notationHtml(d.titre)}</figcaption>${d.svg}<p>${notationHtml(d.legende)}</p></figure>`),
    avertissements(c).map((a) => `<p>${notationHtml(a)}</p>`).join('') + rendreResultat(c),
  ].map(trHtml);
  const note = noteDeCalculHtml(noteDuCalcul(outil, v, c, { projet: 'Hall', element: '', date: '2026-10-30' }), STYLES_TRACE);
  const csv = resultatsEnCsv(blocsEnTexte(trBlocs([...blocsDEntree(outil, v), ...blocsDuCalcul(c)])));
  return { ecran, note, csv };
}

describe('page anglaise', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('meme squelette que la page francaise', () => {
    expect(squelette(en)).toEqual(squelette(fr));
  });

  it('langue, script commun, liens entre les deux versions', () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('src="../src/main.ts"');
    expect(en).toMatch(/class="barre-langue" href="\.\.\/"/);
    expect(fr).toMatch(/class="barre-langue" href="en\/"/);
  });

  it('titre anglais, aucun reste de francais', () => {
    expect(contenuBalise(en, 'h1')).toBe('Steel connections');
    expect(controler('page', en.replace(/lang="fr"[^>]*>FR</, '>'))).toEqual([]);
  });
});

describe('affichage en anglais', () => {
  beforeEach(() => definirLangue('en'));
  afterEach(() => definirLangue('fr'));

  it('selecteur, descriptions, formulaires, hypotheses', () => {
    const constats: string[] = [];
    constats.push(...controler('outils', trHtml(OUTILS.map((o) => `<p>${notationTexte(o.nom)}</p><p>${notationTexte(o.description)}</p>`).join(''))));
    for (const o of OUTILS) {
      constats.push(...controler(`${o.id} formulaire`, trHtml(formulaireHtml(o.id))));
      constats.push(...controler(`${o.id} limites`, `<p>${tr(notationTexte(`Hypothèses et limites : ${hypotheses(o.id).join(' ')}`))}</p>`));
    }
    expect(constats).toEqual([]);
  });

  it('ecran, dessins, note et CSV de chaque detail et de ses variantes', () => {
    const constats: string[] = [];
    let calcules = 0;
    for (const o of OUTILS) {
      variantes(o.id).forEach((v, i) => {
        const s = sorties(o.id, v);
        if ('erreur' in s) {
          constats.push(...controler(`${o.id} ${i} erreur`, `<p>${s.erreur}</p>`));
          return;
        }
        calcules++;
        constats.push(...s.ecran.flatMap((h, j) => controler(`${o.id} ${i} ecran ${j}`, h)));
        constats.push(...controler(`${o.id} ${i} note`, s.note));
        constats.push(...controlerCsv(`${o.id} ${i} csv`, s.csv));
      });
    }
    expect(calcules).toBeGreaterThan(OUTILS.length * 3);
    expect(constats).toEqual([]);
  });

  it('messages et erreurs de saisie', () => {
    const constats: string[] = [];
    for (const o of OUTILS) {
      const d = valeursParDefaut(o.id);
      for (const cle of Object.keys(d)) {
        for (const mauvais of ['abc', '-1', '0']) {
          const l = lireSaisie(o.id, { ...d, [cle]: mauvais });
          const message = l.ok ? (() => {
            try {
              calculer(l.modele);
              return '';
            } catch (e) {
              return messageDErreur(e);
            }
          })() : l.message;
          if (message !== '') constats.push(...controler(`${o.id} ${cle}=${mauvais}`, `<p>${tr(notationTexte(message))}</p>`));
        }
      }
    }
    for (const m of ['Aucun calcul valide à exporter : corriger la saisie, puis réessayer.', 'Une nouvelle version est disponible. Recharger maintenant ?', 'Fichier illisible.', 'element absent de la page : #x']) {
      constats.push(...controler('message', `<p>${tr(notationTexte(m))}</p>`));
    }
    expect(constats).toEqual([]);
  });
});
