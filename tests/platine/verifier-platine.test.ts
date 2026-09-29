import { describe, expect, it } from 'vitest';

import { ec3Recommande } from '../../src/norms/ec3-recommande';
import { verifierPlatine } from '../../src/platine/verifier-platine';
import { chaiseDeReference } from '../fixtures/chaise';

describe('verifierPlatine — appui continu sur beton', () => {
  const r = verifierPlatine(chaiseDeReference(), 1000, 0.5, 235, ec3Recommande());

  it('troncon en te et poinconnement, sans flexion entre ames', () => {
    expect(r.troncon?.taux).toBeCloseTo(0.88619, 3);
    expect(r.poinconnement.taux).toBeCloseTo(0.521351, 6);
    expect(r.flexion).toBeNull();
    expect(r.sectionNette).toBeNull();
    expect(r.cisaillement).toBeNull();
  });

  it('refuse l appui continu sur lierne', () => {
    const a = chaiseDeReference();
    a.appui = { type: 'lierne-acier', t_w_lierne: 8 };
    expect(() => verifierPlatine(a, 1000, 0.5, 235, ec3Recommande())).toThrow(/appui continu/);
  });
});

describe('verifierPlatine — appui aux extremites sur lierne', () => {
  const a = chaiseDeReference();
  a.schema = 'appui-extremites';
  a.plats.L = 600;
  a.appui = { type: 'lierne-acier', t_w_lierne: 8, h_w_lierne: 200, t_f_lierne: 12, b_f_lierne: 90 };
  const r = verifierPlatine(a, 1000, 0.5, 235, ec3Recommande());

  it('flexion entre ames, section nette, cisaillement', () => {
    expect(r.troncon).toBeNull();
    expect(r.flexion?.M_Ed).toBeCloseTo(36.666667, 6);
    expect(r.sectionNette?.taux).toBeCloseTo(3.152088, 6);
    expect(r.cisaillement?.taux).toBeCloseTo(0.614202, 6);
  });
});
