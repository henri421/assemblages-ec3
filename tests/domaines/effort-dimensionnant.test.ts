import { describe, expect, it } from 'vitest';

import { effortDimensionnant } from '../../src/domaines/effort-dimensionnant';

describe('effortDimensionnant — bascule de l origine de l effort', () => {
  it('l ELU gouverne quand il depasse l epreuve et 0,9 F_tk', () => {
    const r = effortDimensionnant({ N_ELU: 900, P_p: 800, F_tk: 950 });
    // 0,9 * 950 = 855 < 900
    expect(r.origine).toBe('ELU');
    expect(r.N_Ed).toBe(900);
  });

  it('l epreuve gouverne quand elle depasse l ELU et 0,9 F_tk', () => {
    const r = effortDimensionnant({ N_ELU: 700, P_p: 880, F_tk: 950 });
    expect(r.origine).toBe('epreuve');
    expect(r.N_Ed).toBe(880);
  });

  it('la capacite de l armature gouverne quand 0,9 F_tk depasse le reste', () => {
    const r = effortDimensionnant({ N_ELU: 700, P_p: 800, F_tk: 1000 });
    expect(r.origine).toBe('capacite-armature');
    expect(r.N_Ed).toBe(900);
    expect(r.termes.capaciteArmature).toBe(900);
  });

  it('sans P_p ni F_tk, seul l ELU est compare', () => {
    const r = effortDimensionnant({ N_ELU: 500 });
    expect(r.origine).toBe('ELU');
    expect(r.termes.epreuve).toBeNull();
    expect(r.termes.capaciteArmature).toBeNull();
  });

  it('a egalite, l ELU est nomme', () => {
    expect(effortDimensionnant({ N_ELU: 900, P_p: 900, F_tk: 1000 }).origine).toBe('ELU');
  });
});

describe('effortDimensionnant — inclinaison', () => {
  it('sous 3 degres, aucune composante tangentielle', () => {
    const r = effortDimensionnant({ N_ELU: 1000 }, 3);
    expect(r.inclinaisonPriseEnCompte).toBe(false);
    expect(r.H_Ed).toBe(0);
  });

  it('au-dela de 3 degres, H_Ed = N_Ed sin(alpha)', () => {
    const r = effortDimensionnant({ N_ELU: 1000 }, 5);
    expect(r.inclinaisonPriseEnCompte).toBe(true);
    // sin(5 deg) = 0,0871557
    expect(r.H_Ed).toBeCloseTo(87.1557, 4);
  });

  it('refuse une inclinaison negative ou droite', () => {
    expect(() => effortDimensionnant({ N_ELU: 1000 }, -1)).toThrow(/inclinaison/i);
    expect(() => effortDimensionnant({ N_ELU: 1000 }, 90)).toThrow(/inclinaison/i);
  });
});

describe('effortDimensionnant — entrees invalides', () => {
  it('refuse un effort ELU nul', () => {
    expect(() => effortDimensionnant({ N_ELU: 0 })).toThrow(/N_ELU/);
  });

  it('refuse une traction d epreuve negative', () => {
    expect(() => effortDimensionnant({ N_ELU: 100, P_p: -1 })).toThrow(/epreuve/i);
  });

  it('refuse une resistance d armature non finie', () => {
    expect(() => effortDimensionnant({ N_ELU: 100, F_tk: Number.NaN })).toThrow(/armature/i);
  });
});
