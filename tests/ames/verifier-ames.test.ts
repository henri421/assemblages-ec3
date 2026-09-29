import { describe, expect, it } from 'vitest';

import { verifierAmes } from '../../src/ames/verifier-ames';
import { ec3Recommande } from '../../src/norms/ec3-recommande';
import { chaiseDeReference, chaiseSurLierne } from '../fixtures/chaise';

describe('verifierAmes — appui continu', () => {
  it('poutre en te sous la pression collectee', () => {
    const r = verifierAmes(chaiseDeReference(), 1000, 0.5, 'S235', ec3Recommande(), {
      sigma_c: 12,
      w_s: 62.5,
    });
    expect(r.flexion.M_Ed).toBeCloseTo(2.109375, 12);
    expect(r.lierne).toBeNull();
    expect(r.deversement).toMatch(/torsion/);
  });

  it('refuse l absence de pression collectee', () => {
    expect(() => verifierAmes(chaiseDeReference(), 1000, 0.5, 'S235', ec3Recommande())).toThrow(
      /pression/,
    );
  });
});

describe('verifierAmes — appui aux extremites sur lierne', () => {
  const r = verifierAmes(chaiseSurLierne(), 1000, 0.5, 'S235', ec3Recommande());

  it('poutre de portee L', () => {
    expect(r.flexion.tauxFlexion).toBeCloseTo(1.113619, 6);
    expect(r.classe.classe3Atteinte).toBe(true);
    expect(r.torsion.taux).toBeCloseTo(0.577595, 6);
    expect(r.voilementCisaillement.aVerifier).toBe(false);
  });

  it('charge transversale sur la lierne : une ame a la fois (l_y = 179,5 < e = 220)', () => {
    expect(r.lierne?.combinee).toBeNull();
    expect(r.lierne?.gouvernant.taux).toBeCloseTo(0.658384, 6);
  });

  it('ames rapprochees : la paire est verifiee ensemble', () => {
    const a = chaiseSurLierne();
    a.plats.e = 150;
    a.ancrage.D = 90;
    const serre = verifierAmes(a, 1000, 0.5, 'S235', ec3Recommande());
    // s_s = 80 + 150 = 230 ; l_y = 230 + 99,5356 = 329,5356 ; F_Rd = 235 * 329,5356 * 9 / 1000 = 696,97
    expect(serre.lierne?.combinee?.s_s).toBe(230);
    expect(serre.lierne?.combinee?.F_Rd).toBeCloseTo(696.967792, 4);
    expect(serre.lierne?.gouvernant).toBe(serre.lierne?.combinee);
  });

  it('refuse une lierne mal decrite', () => {
    const a = chaiseSurLierne();
    a.appui = { type: 'lierne-acier', t_w_lierne: 9 };
    expect(() => verifierAmes(a, 1000, 0.5, 'S235', ec3Recommande())).toThrow(/lierne/);
  });
});
