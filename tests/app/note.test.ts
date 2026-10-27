/**
 * Tests d'acceptation de la note de calcul commune (etape 8, lot 8.7) :
 * contenu range dans les sections de la note d'aedificium-ui, conclusions
 * generees depuis les taux du noyau et les regles bloquantes des dispositions.
 *
 * Purs (aucun jsdom) : ils tournent sur le banc local.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noteDeCalculHtml, texteVisible, type ElementNote, type NoteDeCalcul } from 'aedificium-ui';
import { FORMULAIRES, OUTILS, lireSaisie, valeursParDefaut, type Outil } from '../../app/src/form';
import { calculer, type Calcul } from '../../app/src/calcul';
import { blocsDuCalcul, titreDuVerdict, titreOrganes } from '../../app/src/view';
import { dessinsDuCalcul } from '../../app/src/draw';
import { avertissements, hypotheses } from '../../app/src/hypotheses';
import { accentue } from '../../app/src/accents';
import { blocsDEntree, noteDuCalcul } from '../../app/src/sorties';
import { STYLES_TRACE } from '../../app/src/export';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

const CARTOUCHE = { projet: 'Pont de la Sûre', element: 'Tête d\'ancrage T4', date: '2026-10-27' };

function calcul(outil: Outil): { v: Record<string, string>; c: Calcul } {
  const v = valeursParDefaut(outil);
  const lecture = lireSaisie(outil, v);
  if (!lecture.ok) throw new Error(`${outil} : ${lecture.message}`);
  return { v, c: calculer(lecture.modele) };
}

function note(outil: Outil, cartouche = CARTOUCHE): { v: Record<string, string>; c: Calcul; n: NoteDeCalcul } {
  const { v, c } = calcul(outil);
  return { v, c, n: noteDuCalcul(outil, v, c, cartouche) };
}

type Bloc = Extract<ElementNote, { type: 'bloc' }>;
type Tableau = Extract<ElementNote, { type: 'tableau' }>;
const blocs = (els: ElementNote[] | undefined): Bloc[] => (els ?? []).filter((e): e is Bloc => e.type === 'bloc');
const titresDe = (els: ElementNote[] | undefined): string[] => blocs(els).map((b) => b.bloc.titre);
const tableaux = (els: ElementNote[] | undefined): Tableau[] => (els ?? []).filter((e): e is Tableau => e.type === 'tableau');
const figures = (els: ElementNote[] | undefined) =>
  (els ?? []).filter((e): e is Extract<ElementNote, { type: 'figure' }> => e.type === 'figure');

const IDS = OUTILS.map((o) => o.id);

// --- Cartouche --------------------------------------------------------------

describe('cartouche', () => {
  it('projet, element et date recopies ; outil et norme fixes', () => {
    const k = note('chaise-ancrage').n.cartouche;
    expect(k.projet).toBe('Pont de la Sûre');
    expect(k.element).toBe('Tête d\'ancrage T4');
    expect(k.date).toBe('2026-10-27');
    expect(k.outil).toBe('assemblages-ec3');
    expect(k.norme).toBe('EN 1993-1-8:2005');
  });

  it('element vide : nom du detail (OUTILS)', () => {
    for (const id of ['te', 'eclissage-boulonne'] as Outil[]) {
      const k = note(id, { ...CARTOUCHE, element: '  ' }).n.cartouche;
      expect(k.element).toBe(OUTILS.find((o) => o.id === id)!.nom);
    }
  });
});

// --- Rangement --------------------------------------------------------------

describe('rangement par section', () => {
  for (const id of IDS) it(`${id} : chaque groupe de saisie sort une fois, dans la bonne section`, () => {
    const { v, n } = note(id);
    const s = n.sections;
    const entrees = blocsDEntree(id, v).map((b) => accentue(b.titre));
    const ranges = [s.geometrie, s.materiaux, s.hypotheses, s.charges].flatMap(titresDe);
    expect([...ranges].sort()).toEqual([...entrees].sort());
    for (const t of titresDe(s.materiaux)) expect(t).toMatch(/^(Matériau|Soudage)/);
    for (const t of titresDe(s.charges)) expect(t).toMatch(/^(Actions|Sollicitation)/);
    expect(titresDe(s.hypotheses).filter((t) => t !== 'Coefficients')).toEqual([]);
    expect(titresDe(s.geometrie).filter((t) => /^(Matériau|Soudage|Actions|Sollicitation|Coefficients)/.test(t))).toEqual([]);
    expect(s.combinaisons ?? []).toHaveLength(0);
  });

  it('les groupes de saisie gardent leurs lignes (symbole = cle du champ, accentuee comme a l ecran)', () => {
    const { v, n } = note('chaise-ancrage');
    const platine = blocs(n.sections.geometrie).find((b) => b.bloc.titre === 'Platine')!.bloc;
    const source = blocsDEntree('chaise-ancrage', v).find((b) => b.titre === 'Platine')!;
    expect(platine.lignes.map((l) => l.symbole)).toEqual(source.lignes.map((l) => accentue(l.symbole)));
    expect(platine.lignes.map((l) => l.valeur)).toEqual(source.lignes.map((l) => accentue(l.valeur)));
  });

  it('hypotheses : la liste du detail en premier, accentuee', () => {
    for (const id of IDS) {
      const h = note(id).n.sections.hypotheses ?? [];
      expect(h[0]).toEqual({ type: 'liste', items: hypotheses(id).map(accentue) });
    }
  });

  for (const id of IDS) it(`${id} : geometrie porte les dessins du calcul, dans l ordre, legendes`, () => {
    const { c, n } = note(id);
    const f = figures(n.sections.geometrie);
    const d = dessinsDuCalcul(c);
    expect(f.map((x) => x.svg)).toEqual(d.map((x) => x.svg));
    f.forEach((x, i) => {
      expect(x.legende ?? '').toContain(d[i].titre);
      expect(x.legende ?? '').toContain(accentue(d[i].legende));
    });
  });

  for (const id of IDS) it(`${id} : calculs = grandeurs du calcul, tableau des organes, dispositions`, () => {
    const { c, n } = note(id);
    const k = n.sections.calculs ?? [];
    expect(titresDe(k)).toEqual(blocsDuCalcul(c).map((b) => accentue(b.titre)));
    const t = tableaux(k);
    const organes = t.find((x) => x.titre === titreOrganes(c));
    const pleinePenetration = (c.detail === 'te' || c.detail === 'recouvrement' || c.detail === 'profile-platine') && c.resultat.cordons === null;
    if (!pleinePenetration) {
      expect(organes).toBeDefined();
      const attendu =
        c.detail === 'eclissage-boulonne'
          ? c.resultat.pression.length
          : c.detail === 'chaise-ancrage'
            ? c.resultat.soudures.verifications.length
            : c.resultat.cordons!.points.length;
      expect(organes!.lignes).toHaveLength(attendu);
      for (const ligne of organes!.lignes) expect(ligne).toHaveLength(organes!.entetes.length);
    }
    const dispositions = t.find((x) => x.titre === 'Dispositions constructives');
    expect(dispositions).toBeDefined();
    expect(dispositions!.lignes).toHaveLength(c.resultat.dispositions.constats.length);
  });

  it('cordons : le point gouvernant est marque dans le tableau', () => {
    const { n } = note('te');
    const organes = tableaux(n.sections.calculs).find((x) => x.titre === 'Cordons')!;
    expect(organes.lignes.filter((l) => /gouvernant/.test(l[0]))).toHaveLength(1);
  });

  it('mecanismes sans objet : listes dans les calculs avec leur motif, absents des conclusions', () => {
    for (const id of IDS) {
      const { c, n } = note(id);
      const sansObjet = c.resultat.taux.filter((t) => !t.applicable);
      const texte = JSON.stringify(n.sections.calculs);
      for (const t of sansObjet) {
        expect(texte).toContain(accentue(t.libelle));
        expect(texte).toContain(accentue(t.notApplicableReason ?? ''));
      }
    }
  });

  it('avertissements recopies, accentues', () => {
    for (const id of IDS) {
      const { c, n } = note(id);
      expect(n.avertissements ?? []).toEqual(avertissements(c).map(accentue));
    }
  });
});

// --- Verifications ----------------------------------------------------------

describe('verifications', () => {
  for (const id of IDS) it(`${id} : taux applicables du noyau dans l ordre, puis regles bloquantes sans ratio`, () => {
    const { c, n } = note(id);
    const appl = c.resultat.taux.filter((t) => t.applicable);
    const regles = c.resultat.dispositions.constats.filter((r) => r.applicable && r.severite === 'bloquante');
    expect(n.verifications).toHaveLength(appl.length + regles.length);
    appl.forEach((t, i) => {
      const v = n.verifications[i];
      expect(v.nom).toBe(accentue(t.libelle) + (t.famille === 'service' ? ' (service)' : ''));
      expect(v.clause).toBe(accentue(t.clause));
      expect(v.taux).toBe(t.valeur);
      expect(v.ok).toBe(t.valeur <= 1);
    });
    regles.forEach((r, j) => {
      const v = n.verifications[appl.length + j];
      expect(v.nom).toBe(accentue(r.enonce));
      expect(v.clause).toBe(accentue(r.clause));
      expect(v.taux).toBeNull();
      expect(v.ok).toBe(r.satisfaite);
    });
  });
});

// --- Note HTML complete -----------------------------------------------------

describe('note HTML complete', () => {
  for (const id of IDS) it(`${id} : sections dans l ordre, pas de combinaisons, aucun NaN`, () => {
    const html = noteDeCalculHtml(note(id).n, STYLES_TRACE);
    const titres = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => texteVisible(m[1]).trim().replace(/^\d+\.\s*/, ''));
    expect(titres).toEqual(['Géométrie', 'Matériaux', 'Hypothèses', 'Cas de charges', 'Calculs et vérifications', 'Conclusions']);
    expect(html).not.toContain('NaN');
  });

  it('AUCUN verdict global : ni le titre du verdict du noyau, ni « Conforme »', () => {
    for (const id of IDS) {
      const { c, n } = note(id);
      const t = texteVisible(noteDeCalculHtml(n, STYLES_TRACE));
      expect(t).not.toContain(titreDuVerdict(c.resultat.verdict));
      expect(t).not.toMatch(/\bconforme\b/i);
    }
  });
});

// --- Cablage (lecture du source) --------------------------------------------

describe('cablage', () => {
  const main = lire('../../app/src/main.ts');
  const page = lire('../../app/index.html');
  const exportTs = lire('../../app/src/export.ts');

  it('le volet des sorties porte les champs projet et element, gardes dans localStorage', () => {
    expect(page).toMatch(/data-role="projet"/);
    expect(page).toMatch(/data-role="element"/);
    expect(main).toContain('assemblages-ec3:cartouche');
  });

  it('exporterNote passe par noteDuCalcul et la note commune ; plus de note locale dans export.ts', () => {
    expect(main).toMatch(/noteDeCalculHtml\(\s*noteDuCalcul\(/);
    expect(main).toMatch(/import\s*\{[^}]*noteDeCalculHtml[^}]*\}\s*from\s*'aedificium-ui'/);
    expect(exportTs).not.toMatch(/export function noteDeCalculHtml|export interface NoteDeCalcul/);
  });
});

// Les groupes de saisie de tous les details sont connus du rangement.
describe('groupes de saisie', () => {
  it('aucun titre de groupe inattendu', () => {
    const connus = /^(Matériau|Soudage|Coefficients|Actions|Sollicitation|Platine|Âmes|Cordons|Appui|Éléments|Soudure|Plats|Profilé|Boulons|Tête d'ancrage)/;
    for (const id of IDS) for (const g of FORMULAIRES[id]) expect(g.titre).toMatch(connus);
  });
});
