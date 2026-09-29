import { describe, expect, it } from 'vitest';

import { chargeTransversale, voilementParCisaillement } from '../../src/ames/voilement';

describe('voilementParCisaillement', () => {
  it('72 eps / eta = 60 en S235', () => {
    const v = voilementParCisaillement(150, 20, 235, 1.2);
    expect(v.limite).toBeCloseTo(60, 12);
    expect(v.aVerifier).toBe(false);
    expect(v.taux).toBeCloseTo(0.125, 12);
  });

  it('signale une ame trop elancee', () => {
    expect(voilementParCisaillement(700, 10, 235, 1.2).aVerifier).toBe(true);
  });
});

describe('chargeTransversale — UPN 220 sous une extremite d ame', () => {
  /**
   * t_w = 9, h_w = 195, t_f = 12,5, b_f = 80, S235 ; s_s = 20 + 2*30 = 80
   * F_cr = 0,9 * 6 * 210000 * 729 / 195 = 4239,415 kN
   * m_1 = 80 / 9 = 8,888889
   * avec m_2 = 4,8672 : l_y = 197,723, lambda_F = 0,314073 <= 0,5 -> m_2 = 0
   * l_y = 80 + 25 (1 + racine(8,888889)) = 179,535599 ; lambda_F = 0,299280
   * chi_F = 1 ; F_Rd = 235 * 179,535599 * 9 = 379,717792 kN ; taux 250 / 379,72 = 0,658384
   */
  const r = chargeTransversale(
    { t_w: 9, h_w: 195, t_f: 12.5, b_f: 80, f_yw: 235, f_yf: 235 },
    80,
    250,
    210000,
    1,
  );

  it('grandeurs intermediaires', () => {
    expect(r.F_cr).toBeCloseTo(4239.415385, 5);
    expect(r.m_1).toBeCloseTo(8.888889, 6);
    expect(r.m_2).toBe(0);
    expect(r.l_y).toBeCloseTo(179.535599, 5);
    expect(r.lambda_F).toBeCloseTo(0.29928, 5);
    expect(r.chi_F).toBe(1);
  });

  it('resistance et taux', () => {
    expect(r.F_Rd).toBeCloseTo(379.717792, 5);
    expect(r.taux).toBeCloseTo(0.658384, 6);
  });

  it('une ame mince garde m_2 et voit chi_F chuter', () => {
    const mince = chargeTransversale(
      { t_w: 4, h_w: 400, t_f: 10, b_f: 100, f_yw: 355, f_yf: 355 }, 50, 50, 210000, 1,
    );
    expect(mince.m_2).toBeGreaterThan(0);
    expect(mince.chi_F).toBeLessThan(1);
  });

  it('borne la semelle d un U a t_w + 15 eps t_f', () => {
    const large = chargeTransversale(
      { t_w: 6, h_w: 200, t_f: 8, b_f: 200, f_yw: 235, f_yf: 235 }, 80, 100, 210000, 1,
    );
    expect(large.b_f_eff).toBe(126);
  });

  it('refuse une semelle absente', () => {
    expect(() =>
      chargeTransversale({ t_w: 9, h_w: 195, t_f: 0, b_f: 80, f_yw: 235, f_yf: 235 }, 80, 250, 210000, 1),
    ).toThrow(/semelle/);
  });
});
