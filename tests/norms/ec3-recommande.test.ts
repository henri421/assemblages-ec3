import { describe, expect, it } from 'vitest';

import { ec3Recommande, validerProfil } from '../../src/norms/ec3-recommande';

describe('ec3Recommande', () => {
  it('rend les valeurs recommandees', () => {
    const p = ec3Recommande();
    expect(p.gamma_M0).toBe(1.0);
    expect(p.gamma_M1).toBe(1.0);
    expect(p.gamma_M2).toBe(1.25);
    expect(p.eta).toBe(1.2);
    expect(p.E).toBe(210000);
    expect(p.beta_j).toBeCloseTo(2 / 3, 15);
  });

  it('rend un objet neuf a chaque appel, que l on peut deriver sans effet de bord', () => {
    const derive = { ...ec3Recommande(), gamma_M2: 1.3 };
    expect(derive.gamma_M2).toBe(1.3);
    expect(ec3Recommande().gamma_M2).toBe(1.25);
  });
});

describe('validerProfil', () => {
  it('accepte le profil recommande', () => {
    expect(validerProfil(ec3Recommande()).name).toBe('EC3_recommande');
  });

  it('refuse un coefficient partiel nul', () => {
    expect(() => validerProfil({ ...ec3Recommande(), gamma_M2: 0 })).toThrow(/gamma_M2/);
  });
});
