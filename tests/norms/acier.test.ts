import { describe, expect, it } from 'vitest';

import { epsilon, limiteElastique, resistanceUltime } from '../../src/norms/acier';

describe('limiteElastique', () => {
  it('rend le palier t <= 40 mm', () => {
    expect(limiteElastique('S235', 40)).toBe(235);
    expect(limiteElastique('S355', 20)).toBe(355);
    expect(limiteElastique('S460', 12)).toBe(460);
  });

  it('rend le palier 40 < t <= 80 mm', () => {
    expect(limiteElastique('S235', 40.5)).toBe(215);
    expect(limiteElastique('S355', 80)).toBe(335);
  });

  it('refuse une epaisseur hors du tableau 3.1', () => {
    expect(() => limiteElastique('S355', 81)).toThrow(/80 mm/);
  });

  it('refuse une epaisseur nulle ou negative', () => {
    expect(() => limiteElastique('S355', 0)).toThrow(/epaisseur/i);
    expect(() => limiteElastique('S355', -5)).toThrow(/epaisseur/i);
  });
});

describe('resistanceUltime', () => {
  it('suit les deux paliers', () => {
    expect(resistanceUltime('S235', 10)).toBe(360);
    expect(resistanceUltime('S275', 50)).toBe(410);
    expect(resistanceUltime('S355', 10)).toBe(510);
    expect(resistanceUltime('S355', 50)).toBe(470);
  });
});

describe('epsilon', () => {
  it('vaut 1 en S235 et 0,8136 en S355', () => {
    expect(epsilon(235)).toBe(1);
    expect(epsilon(355)).toBeCloseTo(0.8136165, 7);
  });

  it('refuse une limite elastique nulle', () => {
    expect(() => epsilon(0)).toThrow(/limite elastique/i);
  });
});
