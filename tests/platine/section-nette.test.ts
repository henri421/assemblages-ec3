import { describe, expect, it } from 'vitest';

import { flexionEntreAmes } from '../../src/platine/flexion';
import { verifierSectionNette } from '../../src/platine/section-nette';

describe('verifierSectionNette', () => {
  const f = flexionEntreAmes(1000, 220, 300, 300);

  it('M_Rd,net = (w - d_0) t^2 f_y / 4', () => {
    // 220 * 900 * 235 / 4 = 11 632 500 N.mm = 11,6325 kN.m
    const r = verifierSectionNette(f, 80, 30, 235, 1);
    expect(r.largeurNette).toBe(220);
    expect(r.M_Rd_net).toBeCloseTo(11.6325, 9);
    expect(r.taux).toBeCloseTo(3.152088, 6);
    expect(r.tauxBorneHaute).toBeCloseTo(4.728132, 6);
    expect(r.modeleDePlaqueNecessaire).toBe(true);
  });

  it('sous 0,80, aucun modele de plaque n est reclame', () => {
    const r = verifierSectionNette(flexionEntreAmes(200, 220, 300, 300), 80, 30, 235, 1);
    // 7,3333 / 11,6325 = 0,630417
    expect(r.taux).toBeCloseTo(0.630418, 5);
    expect(r.modeleDePlaqueNecessaire).toBe(false);
  });

  it('refuse un percage plus large que la platine', () => {
    expect(() => verifierSectionNette(f, 300, 30, 235, 1)).toThrow(/percage/);
  });

  it('refuse une epaisseur nulle', () => {
    expect(() => verifierSectionNette(f, 80, 0, 235, 1)).toThrow(/epaisseur/);
  });
});
