import { describe, expect, it } from 'vitest';

import { calculer } from '../../app/src/calcul';
import { OUTILS, lireSaisie, valeursParDefaut, type Outil } from '../../app/src/form';
import { blocsDuCalcul, constatsDuCalcul, htmlTaux, noteMethodes, rendreResultat } from '../../app/src/view';

function calcul(o: Outil, modif: Record<string, string> = {}) {
  const r = lireSaisie(o, { ...valeursParDefaut(o), ...modif });
  if (!r.ok) throw new Error(r.message);
  return calculer(r.modele);
}

describe('rendreResultat', () => {
  for (const o of OUTILS) {
    it(`${o.id} : verdict, taux, cordons, dispositions et grandeurs`, () => {
      const html = rendreResultat(calcul(o.id));
      expect(html).toMatch(/data-role="verdict"/);
      expect(html).toMatch(/class="taux"/);
      expect(html).toMatch(/class="dispositions"/);
      expect(html).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
});

describe('constats distincts', () => {
  it('la tete d ancrage montre trois constats, les details deux', () => {
    expect(constatsDuCalcul(calcul('chaise-ancrage')).map((c) => c.nom)).toEqual([
      'Resistance',
      'Service',
      'Dispositions',
    ]);
    expect(constatsDuCalcul(calcul('te'))).toHaveLength(2);
  });

  it('service non examine sans traction de blocage', () => {
    const s = constatsDuCalcul(calcul('chaise-ancrage', { P_blocage: '' }))[1];
    expect(s.ok).toBeNull();
  });
});

describe('htmlTaux', () => {
  it('les sans-objet sont affiches avec leur motif', () => {
    const html = htmlTaux(calcul('chaise-ancrage').resultat.taux);
    expect(html).toMatch(/sans objet : appui continu/);
  });
});

describe('noteMethodes', () => {
  it('annonce la coincidence en cisaillement longitudinal pur', () => {
    expect(noteMethodes(calcul('te', { N: '0', V_para: '100' }))).toMatch(/coincident/);
    expect(noteMethodes(calcul('te'))).toMatch(/directionnelle/);
  });
});

describe('blocsDuCalcul', () => {
  it('la tete d ancrage porte ses grandeurs intermediaires', () => {
    const titres = blocsDuCalcul(calcul('chaise-ancrage')).map((b) => b.titre);
    expect(titres).toContain('Appui sur le beton (§6.2.5)');
    expect(titres).toContain('Cordons ame-platine (§4.5.3)');
    expect(titres).toContain('Service au blocage (TA 2020)');
  });
  it('sur lierne, la platine entre les ames apparait', () => {
    const titres = blocsDuCalcul(
      calcul('chaise-ancrage', { schema: 'appui-extremites', type_appui: 'lierne-acier' }),
    ).map((b) => b.titre);
    expect(titres).toContain('Platine entre les ames');
    expect(titres).toContain('Interaction dans la platine (§6.2.1(5))');
  });
});
