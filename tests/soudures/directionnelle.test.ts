import { describe, expect, it } from 'vitest';

import { verifierDirectionnelle } from '../../src/soudures/directionnelle';

/** S235 : f_u = 360 MPa, beta_w = 0,8, gamma_M2 = 1,25 -> f_u/(beta_w gamma_M2) = 360 MPa. */
const S235 = { f_u: 360, beta_w: 0.8, gamma_M2: 1.25 };

describe('verifierDirectionnelle', () => {
  it('arrachement pur : les deux criteres, calcules a la main', () => {
    // sigma = tau = 141,421356 ; equivalente = 2 * 141,421356 = 282,842712
    // taux 1 = 282,842712 / 360 = 0,785674 ; limite 2 = 0,9 * 360 / 1,25 = 259,2
    // taux 2 = 141,421356 / 259,2 = 0,545607
    const r = verifierDirectionnelle(
      { sigma_perp: 141.421356, tau_perp: 141.421356, tau_para: 0 },
      S235,
    );
    expect(r.contrainteEquivalente).toBeCloseTo(282.842712, 5);
    expect(r.limiteEquivalente).toBeCloseTo(360, 9);
    expect(r.tauxEquivalent).toBeCloseTo(0.785674, 6);
    expect(r.limiteNormale).toBeCloseTo(259.2, 9);
    expect(r.critereNormalApplicable).toBe(true);
    expect(r.tauxNormal).toBeCloseTo(0.545607, 6);
    expect(r.taux).toBeCloseTo(0.785674, 6);
  });

  it('le critere 0,9 f_u / gamma_M2 est NON APPLICABLE en compression, jamais satisfait', () => {
    const r = verifierDirectionnelle(
      { sigma_perp: -250, tau_perp: 100, tau_para: 0 },
      S235,
    );
    expect(r.critereNormalApplicable).toBe(false);
    expect(r.tauxNormal).toBeNull();
    expect(r.motifNonApplicable).toMatch(/compression/);
    // Le premier critere, lui, voit la compression : sqrt(62500 + 30000) = 304,138
    expect(r.contrainteEquivalente).toBeCloseTo(304.138127, 5);
  });

  it('beta_Lw reduit les deux limites', () => {
    const r = verifierDirectionnelle(
      { sigma_perp: 100, tau_perp: 0, tau_para: 0 },
      { ...S235, beta_Lw: 0.9 },
    );
    expect(r.limiteEquivalente).toBeCloseTo(324, 9);
    expect(r.limiteNormale).toBeCloseTo(233.28, 9);
  });

  it('refuse une resistance ou un coefficient invalide', () => {
    const c = { sigma_perp: 1, tau_perp: 0, tau_para: 0 };
    expect(() => verifierDirectionnelle(c, { ...S235, f_u: 0 })).toThrow(/f_u/);
    expect(() => verifierDirectionnelle(c, { ...S235, beta_w: -1 })).toThrow(/beta_w/);
    expect(() => verifierDirectionnelle(c, { ...S235, gamma_M2: 0 })).toThrow(/gamma_M2/);
    expect(() => verifierDirectionnelle(c, { ...S235, beta_Lw: 1.1 })).toThrow(/beta_Lw/);
  });

  it('refuse une contrainte non finie', () => {
    expect(() =>
      verifierDirectionnelle({ sigma_perp: Number.NaN, tau_perp: 0, tau_para: 0 }, S235),
    ).toThrow(/sigma_perp/);
  });
});
