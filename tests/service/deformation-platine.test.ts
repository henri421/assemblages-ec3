import { describe, expect, it } from 'vitest';

import { verifierService } from '../../src/service/deformation-platine';

describe('verifierService — appui continu', () => {
  /**
   * P = 600 kN ; A_eff = 84 631,94 mm2 -> sigma = 7,089522 MPa ; c = 72,715198 ; t = 30
   * fleche = 1,5 * 7,089522 * 72,715^4 / (210000 * 30^3) = 0,052436 mm
   * contrainte / f_y = 3 * 7,089522 * 72,715^2 / (900 * 235) = 0,531714 = sigma / f_jd
   */
  const base = {
    schema: 'appui-continu' as const,
    P_blocage: 600,
    A_eff: 84631.94131645084,
    c: 72.71519786124495,
    t: 30,
    f_y: 235,
    E: 210000,
  };

  it('fleche de la console et elasticite', () => {
    const r = verifierService(base);
    expect(r.delta_platine).toBeCloseTo(0.052436, 6);
    expect(r.delta_poutre).toBe(0);
    expect(r.tauxElastique).toBeCloseTo(0.531714, 6);
    expect(r.tauxDeformation).toBeNull();
    expect(r.conforme).toBe(true);
  });

  it('une limite de fleche trop serree rend le constat defavorable', () => {
    const r = verifierService({ ...base, delta_lim: 0.05 });
    expect(r.tauxDeformation).toBeCloseTo(1.048711, 6);
    expect(r.conforme).toBe(false);
  });
});

describe('verifierService — appui aux extremites', () => {
  /**
   * P = 600 kN, part 0,5, L = 300, I = 18 307 591,46, v = 121,097561
   * poutre : fleche 0,043893 mm, contrainte 148,8287 MPa
   * platine : fleche 600000 * 220^3 / (48 * 210000 * 300 * 30^3 / 12) = 0,938977 mm
   *           contrainte 600000 * 220 / (220 * 900) = 666,67 MPa -> 2,836879 f_y
   */
  it('la platine plastifie au blocage : constat defavorable', () => {
    const r = verifierService({
      schema: 'appui-extremites',
      P_blocage: 600,
      part: 0.5,
      L: 300,
      I: 18307591.46341463,
      v_max: 121.09756097560975,
      f_y_poutre: 235,
      e: 220,
      w: 300,
      d_0: 80,
      t: 30,
      f_y: 235,
      E: 210000,
    });
    expect(r.delta_poutre).toBeCloseTo(0.043893, 6);
    expect(r.delta_platine).toBeCloseTo(0.938977, 6);
    expect(r.delta).toBeCloseTo(0.98287, 5);
    expect(r.tauxElastique).toBeCloseTo(2.836879, 6);
    expect(r.conforme).toBe(false);
  });
});

describe('verifierService — entrees invalides', () => {
  it('refuse une traction de blocage nulle', () => {
    expect(() =>
      verifierService({ schema: 'appui-continu', P_blocage: 0, A_eff: 1, c: 1, t: 1, f_y: 1, E: 1 }),
    ).toThrow(/blocage/);
  });
});
