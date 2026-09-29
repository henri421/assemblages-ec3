import { describe, expect, it } from 'vitest';

import { gorgePleineResistance } from '../../src/soudures/pleine-resistance';

describe('gorgePleineResistance', () => {
  it('S235, t_w = 20 mm : a_min = 9,2317 mm, soit 0,4616 t_w', () => {
    // 20 * 235 * 0,8 * 1,25 / (1,41421356 * 360 * 1,0) = 4700 / 509,116882 = 9,231672
    const r = gorgePleineResistance({
      t_w: 20, f_y: 235, f_u: 360, beta_w: 0.8, gamma_M0: 1, gamma_M2: 1.25,
    });
    expect(r.a_min).toBeCloseTo(9.231672, 5);
    expect(r.rapport).toBeCloseTo(0.461584, 5);
    expect(r.penetrationPlusEconomique).toBe(false);
  });

  it('S355, t_w = 20 mm : a_min = 11,0745 mm, soit 0,5537 t_w', () => {
    // 20 * 355 * 0,9 * 1,25 / (1,41421356 * 510) = 7987,5 / 721,248917 = 11,074540
    const r = gorgePleineResistance({
      t_w: 20, f_y: 355, f_u: 510, beta_w: 0.9, gamma_M0: 1, gamma_M2: 1.25,
    });
    expect(r.a_min).toBeCloseTo(11.07454, 5);
  });

  it('signale la penetration au-dela de 0,7 t_w', () => {
    // S460 : 460 * 1,0 * 1,25 / (1,41421356 * 540) = 0,752938 > 0,7
    const r = gorgePleineResistance({
      t_w: 10, f_y: 460, f_u: 540, beta_w: 1, gamma_M0: 1, gamma_M2: 1.25,
    });
    expect(r.rapport).toBeCloseTo(0.752938, 5);
    expect(r.penetrationPlusEconomique).toBe(true);
  });

  it('refuse une epaisseur nulle', () => {
    expect(() =>
      gorgePleineResistance({ t_w: 0, f_y: 235, f_u: 360, beta_w: 0.8, gamma_M0: 1, gamma_M2: 1.25 }),
    ).toThrow(/epaisseur/i);
  });
});
