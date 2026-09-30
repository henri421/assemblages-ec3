import { describe, expect, it } from 'vitest';

import {
  FORMULAIRES,
  OUTILS,
  lireSaisie,
  valeursDepuisModele,
  valeursParDefaut,
} from '../../app/src/form';
import { lireNombre, nombreFr } from '../../app/src/format';

describe('format', () => {
  it('lit la virgule decimale et refuse l infini', () => {
    expect(lireNombre('12,5')).toBe(12.5);
    expect(lireNombre(' ')).toBeNull();
    expect(lireNombre('Infinity')).toBeNull();
  });
  it('ecrit a la francaise, sans -0 ni NaN', () => {
    expect(nombreFr(3.14159, 2)).toBe('3,14');
    expect(nombreFr(-0.0001, 2)).toBe('0,00');
    expect(nombreFr(Number.NaN, 2)).toBe('—');
  });
});

describe('lireSaisie — valeurs de depart', () => {
  for (const o of OUTILS) {
    it(`${o.id} : les valeurs de depart forment un modele valide`, () => {
      const r = lireSaisie(o.id, valeursParDefaut(o.id));
      expect(r.ok).toBe(true);
    });
  }
});

describe('lireSaisie — refus et champs masques', () => {
  it('nomme le champ fautif', () => {
    const v = { ...valeursParDefaut('chaise-ancrage'), t: 'abc' };
    const r = lireSaisie('chaise-ancrage', v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.champ).toBe('t');
  });

  it('un champ masque n est pas reclame : la lierne sur beton', () => {
    const v = { ...valeursParDefaut('chaise-ancrage'), t_w_lierne: '' };
    expect(lireSaisie('chaise-ancrage', v).ok).toBe(true);
  });

  it('un champ facultatif vide vaut « non saisi »', () => {
    const r = lireSaisie('chaise-ancrage', { ...valeursParDefaut('chaise-ancrage'), P_blocage: '' });
    if (!r.ok || r.modele.detail !== 'chaise-ancrage') throw new Error('lecture');
    expect(r.modele.donnees.actions.P_blocage).toBeUndefined();
  });

  it('appui aux extremites sur lierne : la portee et la lierne sont lues', () => {
    const v = { ...valeursParDefaut('chaise-ancrage'), schema: 'appui-extremites', type_appui: 'lierne-acier' };
    const r = lireSaisie('chaise-ancrage', v);
    if (!r.ok || r.modele.detail !== 'chaise-ancrage') throw new Error('lecture');
    expect(r.modele.donnees.assemblage.plats.L).toBe(300);
    expect(r.modele.donnees.assemblage.appui.b_f_lierne).toBe(80);
  });

  it('te, cruciforme et angle donnent un detail te de nature differente', () => {
    for (const o of ['te', 'cruciforme', 'angle'] as const) {
      const r = lireSaisie(o, valeursParDefaut(o));
      if (!r.ok || r.modele.detail !== 'te') throw new Error('lecture');
      expect(r.modele.donnees.nature).toBe(o);
    }
  });
});

describe('valeursDepuisModele', () => {
  for (const o of OUTILS) {
    it(`${o.id} : aller-retour champs -> modele -> champs -> modele`, () => {
      const r1 = lireSaisie(o.id, valeursParDefaut(o.id));
      if (!r1.ok) throw new Error('lecture');
      const { outil, valeurs } = valeursDepuisModele(r1.modele);
      expect(outil).toBe(o.id);
      const r2 = lireSaisie(outil, valeurs);
      if (!r2.ok) throw new Error('relecture');
      expect(r2.modele).toEqual(r1.modele);
    });
  }
});

describe('FORMULAIRES', () => {
  it('chaque cle de champ a une valeur de depart', () => {
    for (const o of OUTILS) {
      const v = valeursParDefaut(o.id);
      for (const g of FORMULAIRES[o.id]) for (const c of g.champs) expect(v[c.cle], `${o.id}.${c.cle}`).toBeDefined();
    }
  });
});
