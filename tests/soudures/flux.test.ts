import { describe, expect, it } from 'vitest';

import { fluxDansLesCordons, longueurChargee, momentDEncastrement } from '../../src/soudures/flux';
import { chaiseDeReference } from '../fixtures/chaise';

const LIMITES = { f_y_platine: 235, f_y_ame: 235 };

describe('longueurChargee', () => {
  it('diffusion a 45 degres dans la platine, bornee par le cordon', () => {
    expect(longueurChargee(300, 150, 30)).toBe(210);
    expect(longueurChargee(180, 150, 30)).toBe(180);
  });
});

describe('momentDEncastrement', () => {
  it('charge centree : P e / 8', () => {
    expect(momentDEncastrement(1000, 110, 220)).toBeCloseTo(27500, 9);
  });

  it('charge excentree : P x (e - x)^2 / e^2, plus fort sur l ame proche', () => {
    // x = 60, e = 220 : 1000 * 60 * 160^2 / 220^2 = 31 735,54
    expect(momentDEncastrement(1000, 60, 220)).toBeCloseTo(31735.537190, 5);
  });
});

describe('fluxDansLesCordons — chaise de reference, appui continu', () => {
  const f = fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...LIMITES });

  it('flux transversal sur la longueur chargee', () => {
    expect(f.l_eff).toBe(300);
    expect(f.l_charge).toBe(210);
    expect(f.part).toBe(0.5);
    expect(f.F_Ed).toBeCloseTo(2.380952, 6);
    expect(f.compressionDansLaGorge).toBe(true);
  });

  it('le moment local est borne par le moment plastique de l ame', () => {
    expect(f.M_encastrement).toBeCloseTo(27.5, 9);
    expect(f.m_encastrement).toBeCloseTo(130.952381, 6);
    expect(f.m_pl_platine).toBeCloseTo(52.875, 9);
    expect(f.m_pl_ame).toBeCloseTo(23.5, 9);
    expect(f.m_Ed).toBeCloseTo(23.5, 9);
    expect(f.borne).toBe('ame');
    expect(f.delta_F).toBeCloseTo(0.783333, 6);
  });

  it('efforts sur les deux cordons', () => {
    const ext = f.cas.find((c) => c.id === 'exterieur');
    const int = f.cas.find((c) => c.id === 'interieur');
    expect(ext?.efforts.p_1).toBeCloseTo(-0.407143, 6);
    expect(int?.efforts.p_1).toBeCloseTo(-1.97381, 5);
    expect(ext?.efforts.p_para).toBe(0);
  });
});

describe('fluxDansLesCordons — le moment local est present meme avec contact direct', () => {
  const a = chaiseDeReference();
  a.soudure.contactDirect = true;
  const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES });

  it('la compression globale quitte la gorge, la traction du moment local y reste', () => {
    expect(f.compressionDansLaGorge).toBe(false);
    const ext = f.cas.find((c) => c.id === 'exterieur');
    const int = f.cas.find((c) => c.id === 'interieur');
    // Cordon exterieur TENDU sous un effort global de compression.
    expect(ext?.efforts.p_1).toBeCloseTo(0.783333, 6);
    expect(int?.efforts.p_1).toBe(0);
  });
});

describe('fluxDansLesCordons — appui aux extremites', () => {
  it('ajoute le flux longitudinal V S_f / I', () => {
    const a = chaiseDeReference();
    a.schema = 'appui-extremites';
    a.plats.L = 600;
    const f = fluxDansLesCordons({
      assemblage: a,
      N_Ed: 1000,
      ...LIMITES,
      ame: { S_f: 100_000, I: 10_000_000 },
    });
    // V = 0,5 * 1000 / 2 = 250 kN ; v = 250 * 1e5 / 1e7 = 2,5 kN/mm
    expect(f.V_Ed).toBe(250);
    expect(f.v_Ed).toBeCloseTo(2.5, 12);
    expect(f.cas[0].efforts.p_para).toBeCloseTo(1.25, 12);
  });

  it('refuse l absence des proprietes de section', () => {
    const a = chaiseDeReference();
    a.schema = 'appui-extremites';
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES })).toThrow(
      /section composee/,
    );
  });
});

describe('fluxDansLesCordons — excentrement et inclinaison', () => {
  it('l ame proche reprend plus de la moitie de l effort', () => {
    const a = chaiseDeReference();
    a.ancrage.excentrement = 22;
    const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES });
    expect(f.part).toBeCloseTo(0.6, 12);
    expect(f.x_charge).toBe(88);
  });

  it('refuse un tirant hors de l entraxe', () => {
    const a = chaiseDeReference();
    a.ancrage.excentrement = 110;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES })).toThrow(
      /excentrement/,
    );
  });

  it('H_Ed est examine dans les trois directions', () => {
    const f = fluxDansLesCordons({
      assemblage: chaiseDeReference(),
      N_Ed: 1000,
      H_Ed: 80,
      ...LIMITES,
    });
    // h = 80 / (4 * 300) = 0,066667 kN/mm
    expect(f.h_Ed).toBeCloseTo(0.0666667, 7);
    expect(f.cas).toHaveLength(6);
    expect(f.cas.find((c) => c.id === 'exterieur-H-long')?.efforts.p_para).toBeCloseTo(
      0.0666667,
      7,
    );
  });
});

describe('fluxDansLesCordons — entrees invalides', () => {
  it('refuse une gorge nulle', () => {
    const a = chaiseDeReference();
    a.soudure.a = 0;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES })).toThrow(/gorge/i);
  });

  it('refuse un effort nul', () => {
    expect(() =>
      fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 0, ...LIMITES }),
    ).toThrow(/N_Ed/);
  });

  it('refuse une epaisseur de platine negative', () => {
    const a = chaiseDeReference();
    a.platine.t = -30;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...LIMITES })).toThrow(
      /epaisseur de platine/i,
    );
  });
});
