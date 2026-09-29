import { describe, expect, it } from 'vitest';

import { verifierAssemblage, type DonneesAssemblage } from '../../src/domaines/verifier-assemblage';
import { chaiseDeReference, chaiseSurLierne } from '../fixtures/chaise';

function reference(): DonneesAssemblage {
  return {
    assemblage: chaiseDeReference(),
    materiau: { nuance: 'S235', qualiteZ: 'Z15' },
    actions: { N_ELU: 1000, P_blocage: 600 },
  };
}

function valeur(r: ReturnType<typeof verifierAssemblage>, id: string): number {
  const t = r.taux.find((x) => x.id === id);
  if (t === undefined) throw new Error(`mecanisme absent : ${id}`);
  return t.valeur;
}

describe('verifierAssemblage — VASSE-1, appui continu sur beton', () => {
  const r = verifierAssemblage(reference());

  it('conforme, l appui sur le beton gouverne', () => {
    expect(r.verdict).toBe('conforme');
    expect(r.mecanismeGouvernant).toBe('appui-beton');
    expect(r.origineEffort).toBe('ELU');
    expect(r.N_Ed).toBe(1000);
  });

  it('taux calcules a la main (docs/validation/vasse.md)', () => {
    expect(valeur(r, 'appui-beton')).toBeCloseTo(0.88619, 3);
    expect(valeur(r, 'arrachement-lamellaire')).toBeCloseTo(0.8, 12);
    expect(valeur(r, 'torsion-raidisseur')).toBeCloseTo(0.577595, 6);
    expect(valeur(r, 'poinconnement-platine')).toBeCloseTo(0.521351, 6);
    // cordon exterieur : p_1 = -0,546484, p_para = 0,209194 kN/mm -> 85,357 MPa / 360
    expect(valeur(r, 'soudure')).toBeCloseTo(0.2371, 3);
    expect(valeur(r, 'service-elastique')).toBeCloseTo(0.5317, 3);
  });

  it('les mecanismes sans objet sont presents, avec leur motif', () => {
    const sn = r.taux.find((t) => t.id === 'section-nette');
    expect(sn?.applicable).toBe(false);
    expect(sn?.notApplicableReason).toMatch(/troncon en te/);
  });

  it('taux tries du plus sollicite au moins sollicite', () => {
    const applicables = r.taux.filter((t) => t.applicable).map((t) => t.valeur);
    expect(applicables).toEqual([...applicables].sort((a, b) => b - a));
  });

  it('trois constats distincts', () => {
    expect(r.constats.resistance.ok).toBe(true);
    expect(r.constats.service?.ok).toBe(true);
    expect(r.constats.dispositions.ok).toBe(true);
  });
});

describe('verifierAssemblage — VASSE-2, sur lierne', () => {
  const r = verifierAssemblage({
    assemblage: chaiseSurLierne(),
    materiau: { nuance: 'S235', qualiteZ: 'Z15' },
    actions: { N_ELU: 1000 },
  });

  it('non conforme en resistance, la section nette gouverne', () => {
    expect(r.verdict).toBe('non-conforme-resistance');
    expect(r.mecanismeGouvernant).toBe('section-nette');
    expect(valeur(r, 'section-nette')).toBeCloseTo(3.152088, 6);
    expect(valeur(r, 'soudure')).toBeCloseTo(0.898668, 6);
    expect(valeur(r, 'charge-transversale-lierne')).toBeCloseTo(0.658384, 6);
    expect(valeur(r, 'interaction-platine')).toBeCloseTo(1.024846, 5);
  });

  it('service non examine sans traction de blocage', () => {
    expect(r.service).toBeNull();
    expect(r.constats.service).toBeNull();
  });
});

describe('verifierAssemblage — bascule du mecanisme gouvernant entre gorge et section nette', () => {
  /**
   * Platine de 50 en S355 (f_y = 335, t > 40), gorge 8, N = 700 kN, sur lierne.
   * M_Ed = 700 * 220 / 6 = 25,6667 kN.m
   * d_0 = 80  : M_Rd,net = 220 * 2500 * 335 / 4 = 46,0625 kN.m -> 0,557214 ; la gorge gouverne
   * d_0 = 180 : M_Rd,net = 120 * 2500 * 335 / 4 = 25,1250 kN.m -> 1,021559 ; la section nette gouverne
   */
  function avecPercage(d_0: number): DonneesAssemblage {
    const a = chaiseSurLierne();
    a.platine.t = 50;
    a.platine.d_0 = d_0;
    a.soudure.a = 8;
    return { assemblage: a, materiau: { nuance: 'S355', qualiteZ: 'Z35' }, actions: { N_ELU: 700 } };
  }

  it('petit percage : la gorge gouverne', () => {
    const r = verifierAssemblage(avecPercage(80));
    expect(r.mecanismeGouvernant).toBe('soudure');
    expect(valeur(r, 'section-nette')).toBeCloseTo(0.557214, 6);
  });

  it('grand percage : la section nette gouverne', () => {
    const r = verifierAssemblage(avecPercage(180));
    expect(r.mecanismeGouvernant).toBe('section-nette');
    expect(valeur(r, 'section-nette')).toBeCloseTo(1.021559, 6);
    // La gorge, elle, n a pas bouge : seul le percage a change.
    expect(valeur(r, 'soudure')).toBeCloseTo(valeur(verifierAssemblage(avecPercage(80)), 'soudure'), 12);
  });
});

describe('verifierAssemblage — verdicts distincts', () => {
  it('non conforme en service seulement', () => {
    const d = reference();
    d.delta_lim = 0.01;
    const r = verifierAssemblage(d);
    expect(r.constats.resistance.ok).toBe(true);
    expect(r.verdict).toBe('non-conforme-service');
  });

  it('non conforme aux dispositions seulement', () => {
    const d = reference();
    d.assemblage.ancrage.inclinaison = 2;
    d.assemblage.plats.e = 205;
    d.assemblage.platine.b = 290;
    const r = verifierAssemblage(d);
    expect(r.constats.resistance.ok).toBe(true);
    expect(r.verdict).toBe('non-conforme-dispositions');
    expect(r.dispositions.violations.join()).toMatch(/TA 2020/);
  });

  it('l effort d epreuve gouverne et le dit', () => {
    const d = reference();
    d.actions = { N_ELU: 700, P_p: 900, F_tk: 950 };
    const r = verifierAssemblage(d);
    expect(r.origineEffort).toBe('epreuve');
    expect(r.N_Ed).toBe(900);
  });
});

describe('verifierAssemblage — entrees invalides', () => {
  it('refuse une epaisseur de platine nulle', () => {
    const d = reference();
    d.assemblage.platine.t = 0;
    expect(() => verifierAssemblage(d)).toThrow(/epaisseur/i);
  });

  it('refuse un profil de coefficients faux', () => {
    const d = reference();
    d.profil = { name: 'x', gamma_M0: 1, gamma_M1: 1, gamma_M2: 0, eta: 1.2, E: 210000, beta_j: 2 / 3, gamma_c: 1.5 };
    expect(() => verifierAssemblage(d)).toThrow(/gamma_M2/);
  });
});
