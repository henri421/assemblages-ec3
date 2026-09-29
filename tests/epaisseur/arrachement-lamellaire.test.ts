import { describe, expect, it } from 'vitest';

import {
  CONDITIONS_PAR_DEFAUT,
  valeurZa,
  valeurZc,
  verifierArrachement,
} from '../../src/epaisseur/arrachement-lamellaire';

describe('valeurZa', () => {
  it('suit les paliers du tableau 3.2 a)', () => {
    expect(valeurZa(7)).toBe(0);
    expect(valeurZa(7.07)).toBe(3);
    expect(valeurZa(14.14)).toBe(6);
    expect(valeurZa(28.3)).toBe(9);
    expect(valeurZa(45)).toBe(15);
    expect(valeurZa(60)).toBe(15);
  });
});

describe('valeurZc', () => {
  it('suit les paliers du tableau 3.2 c)', () => {
    expect(valeurZc(10)).toBe(2);
    expect(valeurZc(30)).toBe(6);
    expect(valeurZc(30.5)).toBe(8);
    expect(valeurZc(75)).toBe(15);
  });
});

describe('verifierArrachement — chaise de reference', () => {
  it('platine de 30, gorge de 10, multipasse, bridage faible : Z_Ed = 12', () => {
    // a_eff = 14,142 -> Z_a = 6 ; Z_b = 0 ; Z_c = 6 ; Z_d = 0 ; Z_e = 0
    const r = verifierArrachement({
      t: 30, a: 10, cordonDAngle: true, conditions: CONDITIONS_PAR_DEFAUT, qualite: 'aucune',
    });
    expect(r.a_eff).toBeCloseTo(14.142136, 6);
    expect(r.Z_Ed).toBe(12);
    expect(r.Z_Rd).toBe(10);
    expect(r.qualiteRequise).toBe('Z15');
    expect(r.taux).toBeCloseTo(1.2, 12);
  });

  it('Z15 suffit', () => {
    const r = verifierArrachement({
      t: 30, a: 10, cordonDAngle: true, conditions: CONDITIONS_PAR_DEFAUT, qualite: 'Z15',
    });
    expect(r.taux).toBeCloseTo(0.8, 12);
  });

  it('le prechauffage retire 8', () => {
    const r = verifierArrachement({
      t: 30, a: 10, cordonDAngle: true,
      conditions: { ...CONDITIONS_PAR_DEFAUT, prechauffage: true }, qualite: 'aucune',
    });
    expect(r.Z_Ed).toBe(4);
    expect(r.qualiteRequise).toBe('aucune');
  });

  it('assemblage d angle fortement bride, platine de 60 : Z35 requise', () => {
    // a = 25 -> a_eff 35,36 -> 12 ; Z_b = 8 ; Z_c = 12 ; Z_d = 5 -> 37
    const r = verifierArrachement({
      t: 60, a: 25, cordonDAngle: true,
      conditions: { forme: 'assemblage-angle', bridage: 'fort', prechauffage: false },
      qualite: 'Z35',
    });
    expect(r.Z_Ed).toBe(37);
    expect(r.qualiteRequise).toBe('Z35');
    expect(r.taux).toBeGreaterThan(1);
  });

  it('penetration : a_eff est la profondeur saisie', () => {
    const r = verifierArrachement({
      t: 30, a: 12, cordonDAngle: false,
      conditions: { ...CONDITIONS_PAR_DEFAUT, forme: 'penetration' }, qualite: 'Z25',
    });
    expect(r.a_eff).toBe(12);
    expect(r.Z_Ed).toBe(6 + 5 + 6);
  });

  it('refuse une epaisseur nulle', () => {
    expect(() =>
      verifierArrachement({ t: 0, a: 10, cordonDAngle: true, conditions: CONDITIONS_PAR_DEFAUT, qualite: 'aucune' }),
    ).toThrow(/epaisseur/);
  });
});
