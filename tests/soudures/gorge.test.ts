import { describe, expect, it } from 'vitest';

import { contraintesDansLaGorge } from '../../src/soudures/gorge';

describe('contraintesDansLaGorge — cordon d angle', () => {
  it('arrachement pur : sigma_perp = tau_perp = p/(racine(2) a), en traction', () => {
    // p_1 = 1 kN/mm, a = 5 mm : 1000 / (5 * 1,41421356) = 141,421356 MPa
    const c = contraintesDansLaGorge({ p_1: 1, p_2: 0, p_para: 0 }, 5);
    expect(c.sigma_perp).toBeCloseTo(141.421356, 6);
    expect(c.tau_perp).toBeCloseTo(141.421356, 6);
    expect(c.tau_para).toBe(0);
  });

  it('element plaque contre sa base : la gorge est comprimee', () => {
    const c = contraintesDansLaGorge({ p_1: -1, p_2: 0, p_para: 0 }, 5);
    expect(c.sigma_perp).toBeCloseTo(-141.421356, 6);
  });

  it('effort qui tire l element attache hors du cordon : la gorge est tendue', () => {
    // Cordon frontal de recouvrement, plat tire vers l interieur (p_2 < 0).
    const c = contraintesDansLaGorge({ p_1: 0, p_2: -1, p_para: 0 }, 5);
    expect(c.sigma_perp).toBeCloseTo(141.421356, 6);
    expect(c.tau_perp).toBeCloseTo(-141.421356, 6);
  });

  it('cisaillement longitudinal : tau_para = p_para / a', () => {
    const c = contraintesDansLaGorge({ p_1: 0, p_2: 0, p_para: 1.2 }, 6);
    expect(c.tau_para).toBeCloseTo(200, 9);
    expect(c.sigma_perp).toBe(0);
  });
});

describe('contraintesDansLaGorge — penetration partielle', () => {
  it('la gorge est parallele a la face de base', () => {
    const c = contraintesDansLaGorge({ p_1: 2, p_2: 0.5, p_para: 0 }, 10, 'penetration-partielle');
    expect(c.sigma_perp).toBeCloseTo(200, 9);
    expect(c.tau_perp).toBeCloseTo(50, 9);
  });
});

describe('contraintesDansLaGorge — entrees invalides', () => {
  it('refuse une gorge nulle ou negative', () => {
    expect(() => contraintesDansLaGorge({ p_1: 1, p_2: 0, p_para: 0 }, 0)).toThrow(/gorge/i);
    expect(() => contraintesDansLaGorge({ p_1: 1, p_2: 0, p_para: 0 }, -3)).toThrow(/gorge/i);
  });

  it('refuse un effort non fini', () => {
    expect(() => contraintesDansLaGorge({ p_1: Number.NaN, p_2: 0, p_para: 0 }, 5)).toThrow(/p_1/);
  });
});
