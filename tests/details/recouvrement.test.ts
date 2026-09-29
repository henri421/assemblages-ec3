import { describe, expect, it } from 'vitest';

import {
  reductionAssemblageLong,
  verifierRecouvrement,
  type DonneesRecouvrement,
} from '../../src/details/recouvrement';

function recouvrement(cordons: DonneesRecouvrement['cordons'], L_r = 100): DonneesRecouvrement {
  return {
    b_p: 100,
    t_p: 10,
    b_b: 120,
    t_b: 10,
    L_r,
    cordons,
    a: 5,
    sollicitations: { N: 100, V: 0, M: 0 },
    materiau: { nuance: 'S235', qualiteZ: 'aucune' },
  };
}

describe('verifierRecouvrement', () => {
  it('cordons lateraux seuls : cisaillement longitudinal pur', () => {
    // A = 2 * 5 * 100 = 1000 ; tau_para = 100 ; equivalente 173,2051 ; taux 0,481125
    const r = verifierRecouvrement(recouvrement({ lateraux: true, frontal: false }));
    expect(r.cordons.taux).toBeCloseTo(0.481125, 6);
    expect(r.cordons.methodesCoincident).toBe(true);
    expect(r.metalAttache.taux).toBeCloseTo(0.425532, 6);
  });

  it('cordon frontal seul : gorge TENDUE, second critere applicable', () => {
    // A = 500 ; tau = 200 selon z ; e_2 = -z -> sigma_perp = +141,42, tau_perp = -141,42
    const r = verifierRecouvrement(recouvrement({ lateraux: false, frontal: true }));
    const g = r.cordons.gouvernant.directionnelle;
    expect(g.sigma_perp).toBeCloseTo(141.421356, 5);
    expect(g.critereNormalApplicable).toBe(true);
    expect(r.cordons.taux).toBeCloseTo(0.785674, 6);
  });

  it('assemblage long : beta_Lw reduit les cordons lateraux', () => {
    // L_j = 1000 > 150 * 5 = 750 : beta_Lw = 1,2 - 0,2 * 1000 / 750 = 0,933333
    expect(reductionAssemblageLong(1000, 5)).toBeCloseTo(0.933333, 6);
    expect(reductionAssemblageLong(700, 5)).toBe(1);
    const r = verifierRecouvrement(recouvrement({ lateraux: true, frontal: false }, 1000));
    expect(r.beta_Lw).toBeCloseTo(0.933333, 6);
    expect(r.cordons.gouvernant.directionnelle.limiteEquivalente).toBeCloseTo(336, 9);
  });

  it('refuse un recouvrement sans cordon', () => {
    expect(() => verifierRecouvrement(recouvrement({ lateraux: false, frontal: false }))).toThrow(
      /au moins un cordon/,
    );
  });

  it('refuse une gorge nulle', () => {
    expect(() => verifierRecouvrement({ ...recouvrement({ lateraux: true, frontal: true }), a: 0 })).toThrow(
      /gorge/,
    );
  });
});
