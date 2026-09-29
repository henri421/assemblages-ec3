import { describe, expect, it } from 'vitest';

import { cisaillementAuDroitDesAmes, flexionEntreAmes, largeurUtile } from '../../src/platine/flexion';

describe('largeurUtile', () => {
  it('min(h ; L_w)', () => {
    expect(largeurUtile(300, 300)).toBe(300);
    expect(largeurUtile(350, 250)).toBe(250);
  });
  it('refuse une hauteur nulle', () => {
    expect(() => largeurUtile(0, 300)).toThrow(/hauteur de platine/);
  });
});

describe('flexionEntreAmes', () => {
  it('les deux bornes et la valeur de predimensionnement', () => {
    // N = 1000 kN, e = 220 mm
    const f = flexionEntreAmes(1000, 220, 300, 300);
    expect(f.M_borneBasse).toBeCloseTo(27.5, 12);
    expect(f.M_borneHaute).toBeCloseTo(55, 12);
    expect(f.M_Ed).toBeCloseTo(36.666667, 6);
    expect(f.w).toBe(300);
  });
  it('refuse un entraxe negatif', () => {
    expect(() => flexionEntreAmes(1000, -1, 300, 300)).toThrow(/entraxe/);
  });
});

describe('cisaillementAuDroitDesAmes', () => {
  it('1,5 V / (w t) contre f_y / racine(3)', () => {
    // V = 500 kN ; tau = 1,5 * 500 000 / (300 * 30) = 83,3333 ; tau_Rd = 135,6773
    const c = cisaillementAuDroitDesAmes(1000, 0.5, 300, 30, 235, 1);
    expect(c.V_Ed).toBe(500);
    expect(c.tau_Ed).toBeCloseTo(83.333333, 6);
    expect(c.tau_Rd).toBeCloseTo(135.677313, 6);
    expect(c.taux).toBeCloseTo(0.614202, 6);
  });
});
