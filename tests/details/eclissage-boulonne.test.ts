import { describe, expect, it } from 'vitest';
import { diametreTrou, verifierEclissage, type DonneesEclissage } from '../../src/index';

/**
 * Eclissage boulonne sous effort axial, EN 1993-1-8:2005.
 * Valeurs attendues calculees a la main.
 *
 * Plats 200 × 12 mm S235 (f_y = 235, f_u = 360 MPa), recouvrement simple,
 * 2 × 2 boulons M20 classe 8.8, filetage dans le plan ; e_1 = 50, p_1 = 70,
 * p_2 = 100 mm, d'ou e_2 = (200 - 100) / 2 = 50 mm ; d_0 = 22 mm ; N = 200 kN.
 *   F_v,Rd = 0,6 × 800 × 245 / 1,25 = 94,08 kN ; F_v,Ed = 50 kN, taux 0,5315.
 *   k_1 = min(2,8 × 50/22 - 1,7 ; 1,4 × 100/22 - 1,7 ; 2,5) = 2,5.
 *   rangee d'extremite : alpha_b = 50 / 66 = 0,7576, F_b,Rd = 2,5 × 0,7576 × 360 × 20 × 12 / 1,25 = 130,91 kN ;
 *   rangee interieure : alpha_b = 70/66 - 0,25 = 0,81061, F_b,Rd = 140,07 kN.
 *   §3.7(1) : F_v,Rd < F_b,Rd -> groupe = 4 × 94,08 = 376,32 kN.
 *   section nette : (200 - 2 × 22) × 12 = 1 872 mm2, N_u,Rd = 0,9 × 1872 × 360 / 1,25 = 485,22 kN.
 *   section brute : N_pl,Rd = 2400 × 235 = 564 kN.
 *   bloc : A_nt = (100 - 22) × 12 = 936, A_nv = 2 × (50 + 70 - 1,5 × 22) × 12 = 2 088 mm2 ;
 *          V_eff,1,Rd = 360 × 936 / 1,25 + 235 × 2088 / √3 = 269,57 + 283,29 = 552,86 kN.
 */

function donnees(o: Partial<DonneesEclissage> = {}): DonneesEclissage {
  return {
    b_p: 200,
    t_p: 12,
    b_b: 200,
    t_b: 12,
    n_s: 1,
    boulons: { classe: '8.8', d: 20, filetageDansLePlan: true },
    n_1: 2,
    n_2: 2,
    e_1: 50,
    p_1: 70,
    p_2: 100,
    N: 200,
    materiau: { nuance: 'S235', qualiteZ: 'aucune' },
    ...o,
  } as DonneesEclissage;
}

const t = (r: ReturnType<typeof verifierEclissage>, id: string) => r.taux.find((x) => x.id === id)?.valeur ?? Number.NaN;

describe('2 × 2 M20 8.8, plats 200 × 12 S235, N = 200 kN', () => {
  const r = verifierEclissage(donnees());

  it('trous normaux : d_0 = 22 mm pour un M20', () => {
    expect(diametreTrou(20)).toBe(22);
    expect(r.d_0).toBe(22);
  });

  it('cisaillement : F_v,Rd = 94,08 kN, taux 0,5315', () => {
    expect(r.F_v_Rd).toBeCloseTo(94.08, 2);
    expect(t(r, 'boulons-cisaillement')).toBeCloseTo(50 / 94.08, 4);
  });

  it('pression diametrale : 130,91 kN en extremite, 140,07 kN a l interieur', () => {
    const bout = r.pression.find((p) => p.position.startsWith('rangee d extremite'));
    const interieur = r.pression.find((p) => p.position.startsWith('rangee interieure'));
    expect(bout?.k_1).toBeCloseTo(2.5, 12);
    expect(bout?.F_b_Rd).toBeCloseTo(130.909, 2);
    expect(interieur?.F_b_Rd).toBeCloseTo(140.073, 2);
  });

  it('groupe : F_v,Rd < F_b,Rd, donc 4 × 94,08 = 376,32 kN', () => {
    expect(r.F_groupe).toBeCloseTo(376.32, 2);
    expect(r.regleGroupe).toMatch(/n_b × min/);
  });

  it('plats : N_pl,Rd = 564 kN, N_u,Rd = 485,22 kN, V_eff,1,Rd = 552,86 kN', () => {
    const p = r.plats[0];
    expect(p.N_pl_Rd).toBeCloseTo(564, 6);
    expect(p.N_u_Rd).toBeCloseTo(485.222, 2);
    expect(p.V_eff_Rd).toBeCloseTo(552.86, 1);
  });

  it('conforme, dispositions respectees, recouvrement simple signale', () => {
    expect(r.verdict).toBe('conforme');
    expect(r.dispositions.ok).toBe(true);
    expect(r.dispositions.informations.join(' ')).toMatch(/excentricite/);
  });
});

describe('cas particuliers', () => {
  it('pression diametrale gouvernante (t = 6 mm) : somme des F_b,Rd = 2 × 65,45 + 2 × 70,04 = 270,98 kN', () => {
    const r = verifierEclissage(donnees({ t_p: 6, t_b: 6 }));
    expect(r.regleGroupe).toMatch(/somme des F_b,Rd/);
    expect(r.F_groupe).toBeCloseTo(270.98, 1);
  });

  it('assemblage long : 8 rangees a 70 mm, L_j = 490 > 15 d, beta_Lf = 1 - 190 / 4000 = 0,9525', () => {
    const r = verifierEclissage(donnees({ n_1: 8, p_1: 70 }));
    expect(r.beta_Lf).toBeCloseTo(0.9525, 10);
    expect(r.F_v_Rd).toBeCloseTo(94.08 * 0.9525, 2);
  });

  it('double recouvrement : deux plans de cisaillement', () => {
    const r = verifierEclissage(donnees({ n_s: 2, t_b: 2 * 8 }));
    expect(r.F_v_Rd).toBeCloseTo(2 * 94.08, 2);
  });

  it('tige lisse dans le plan : alpha_v = 0,6 et aire brute', () => {
    const r = verifierEclissage(donnees({ boulons: { classe: '10.9', d: 20, filetageDansLePlan: false } }));
    expect(r.alpha_v).toBe(0.6);
    expect(r.F_v_Rd).toBeCloseTo((0.6 * 1000 * Math.PI * 100) / 1.25 / 1000, 6);
  });

  it('pince trop faible : non conforme aux dispositions', () => {
    const r = verifierEclissage(donnees({ e_1: 20 }));
    expect(r.dispositions.ok).toBe(false);
    expect(r.verdict).not.toBe('conforme');
  });

  it('effort trop fort : non conforme en resistance', () => {
    expect(verifierEclissage(donnees({ N: 400 })).verdict).toBe('non-conforme-resistance');
  });

  it('refuse un effort de compression et des files qui debordent', () => {
    expect(() => verifierEclissage(donnees({ N: -10 }))).toThrow(/traction/);
    expect(() => verifierEclissage(donnees({ n_2: 3, p_2: 120 }))).toThrow(/debordent/);
  });
});
