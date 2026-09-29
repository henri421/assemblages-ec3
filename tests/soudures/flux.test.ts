import { describe, expect, it } from 'vitest';

import {
  fluxDansLesCordons,
  longueurChargee,
  longueurDAppui,
  momentDEncastrement,
} from '../../src/soudures/flux';
import { AME_DE_REFERENCE, chaiseDeReference } from '../fixtures/chaise';

const COMMUN = { f_y_platine: 235, f_y_ame: 235, ame: AME_DE_REFERENCE };

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
    expect(momentDEncastrement(1000, 60, 220)).toBeCloseTo(31735.53719, 5);
  });
});

describe('fluxDansLesCordons — chaise de reference, appui continu', () => {
  const f = fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN });

  it('suspension de la platine sur la longueur chargee', () => {
    expect(f.l_eff).toBe(300);
    expect(f.l_charge).toBe(210);
    expect(f.part).toBe(0.5);
    expect(f.F_Ed).toBeCloseTo(2.380952, 6);
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

  it('flux longitudinal de la poutre en te sous pression uniforme', () => {
    expect(f.V_Ed).toBeCloseTo(75, 12);
    expect(f.v_Ed).toBeCloseTo(0.566538, 6);
    expect(f.l_appui).toBeNull();
  });

  it('le cordon interieur est le plus tendu', () => {
    const int = f.cas.find((c) => c.id === 'interieur');
    const ext = f.cas.find((c) => c.id === 'exterieur');
    expect(int?.efforts.p_1).toBeCloseTo(1.97381, 5);
    expect(ext?.efforts.p_1).toBeCloseTo(0.407143, 6);
    expect(int?.efforts.p_para).toBeCloseTo(0.283269, 6);
    expect(f.cas).toHaveLength(2);
  });
});

describe('fluxDansLesCordons — le moment local est present meme avec contact direct', () => {
  it('le couple reste dans la gorge du cordon interieur avec ou sans contact', () => {
    const avec = chaiseDeReference();
    avec.soudure.contactDirect = true;
    const fAvec = fluxDansLesCordons({ assemblage: avec, N_Ed: 1000, ...COMMUN });
    const fSans = fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN });
    const pAvec = fAvec.cas.find((c) => c.id === 'interieur')?.efforts.p_1;
    const pSans = fSans.cas.find((c) => c.id === 'interieur')?.efforts.p_1;
    expect(fAvec.delta_F).toBeCloseTo(0.783333, 6);
    expect(pAvec).toBeCloseTo(1.97381, 5);
    expect(pAvec).toBe(pSans);
  });

  it('le contact ne retire que la part COMPRIMEE du couple, sur le cordon exterieur', () => {
    // Ames de 30 : m_pl,w = 900 * 235 / 4 = 52,875 = m_pl,p -> m_Ed = 52,875 (platine)
    // delta_F = 52,875 / (30 + 10) = 1,321875 ; F/2 = 1,190476
    // exterieur : 1,190476 - 1,321875 = -0,131399 kN/mm (comprime)
    const sans = chaiseDeReference();
    sans.plats.t_w = 30;
    const avec = structuredClone(sans);
    avec.soudure.contactDirect = true;
    const fSans = fluxDansLesCordons({ assemblage: sans, N_Ed: 1000, ...COMMUN });
    const fAvec = fluxDansLesCordons({ assemblage: avec, N_Ed: 1000, ...COMMUN });
    expect(fSans.borne).toBe('platine');
    expect(fSans.cas.find((c) => c.id === 'exterieur')?.efforts.p_1).toBeCloseTo(-0.131399, 6);
    expect(fAvec.cas.find((c) => c.id === 'exterieur')?.efforts.p_1).toBe(0);
    // Le cordon interieur, tendu, est identique dans les deux cas : 2,512351
    expect(fAvec.cas.find((c) => c.id === 'interieur')?.efforts.p_1).toBeCloseTo(2.512351, 6);
  });
});

describe('fluxDansLesCordons — appui aux extremites', () => {
  const a = chaiseDeReference();
  a.schema = 'appui-extremites';
  a.plats.L = 600;
  a.appui = { type: 'lierne-acier', t_w_lierne: 8, h_w_lierne: 200, t_f_lierne: 12, b_f_lierne: 90 };

  it('flux longitudinal de la reaction d appui, cas au droit de l appui', () => {
    const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN });
    // V = 0,5 * 1000 / 2 = 250 kN ; v = 250 * 138292,68 / 18307591,46 = 1,888461
    expect(f.V_Ed).toBe(250);
    expect(f.v_Ed).toBeCloseTo(1.888461, 6);
    expect(f.l_appui).toBe(90);
    const appui = f.cas.find((c) => c.id === 'interieur-appui');
    // p_1 = -250 / (2 * 90) = -1,388889 kN/mm
    expect(appui?.efforts.p_1).toBeCloseTo(-1.388889, 6);
    expect(appui?.efforts.p_para).toBeCloseTo(0.9442305, 6);
    expect(f.cas).toHaveLength(4);
  });

  it('le contact retire la compression d appui', () => {
    const b = structuredClone(a);
    b.soudure.contactDirect = true;
    const f = fluxDansLesCordons({ assemblage: b, N_Ed: 1000, ...COMMUN });
    expect(f.cas.find((c) => c.id === 'exterieur-appui')?.efforts.p_1).toBe(0);
  });

  it('longueurDAppui : la semelle de lierne en tient lieu', () => {
    expect(longueurDAppui(a)).toBe(90);
    const b = structuredClone(a);
    b.appui = { type: 'beton', f_ck: 30 };
    expect(() => longueurDAppui(b)).toThrow(/longueur d appui/);
  });
});

describe('fluxDansLesCordons — excentrement et inclinaison', () => {
  it('l ame proche reprend plus de la moitie de l effort', () => {
    const a = chaiseDeReference();
    a.ancrage.excentrement = 22;
    const f = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN });
    expect(f.part).toBeCloseTo(0.6, 12);
    expect(f.x_charge).toBe(88);
  });

  it('refuse un tirant hors de l entraxe', () => {
    const a = chaiseDeReference();
    a.ancrage.excentrement = 110;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(
      /excentrement/,
    );
  });

  it('H_Ed est examine dans les trois directions', () => {
    const f = fluxDansLesCordons({
      assemblage: chaiseDeReference(),
      N_Ed: 1000,
      H_Ed: 80,
      ...COMMUN,
    });
    // h = 80 / (4 * 300) = 0,066667 kN/mm
    expect(f.h_Ed).toBeCloseTo(0.0666667, 7);
    expect(f.cas).toHaveLength(6);
    expect(f.cas.find((c) => c.id === 'interieur-H-long')?.efforts.p_para).toBeCloseTo(
      0.283269 + 0.0666667,
      6,
    );
  });
});

describe('fluxDansLesCordons — entrees invalides', () => {
  it('refuse une gorge nulle', () => {
    const a = chaiseDeReference();
    a.soudure.a = 0;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(/gorge/i);
  });

  it('refuse un effort nul', () => {
    expect(() =>
      fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 0, ...COMMUN }),
    ).toThrow(/N_Ed/);
  });

  it('refuse une epaisseur de platine negative', () => {
    const a = chaiseDeReference();
    a.platine.t = -30;
    expect(() => fluxDansLesCordons({ assemblage: a, N_Ed: 1000, ...COMMUN })).toThrow(
      /epaisseur de platine/i,
    );
  });

  it('refuse une inertie nulle', () => {
    expect(() =>
      fluxDansLesCordons({
        assemblage: chaiseDeReference(),
        N_Ed: 1000,
        ...COMMUN,
        ame: { S_f: 1, I: 0 },
      }),
    ).toThrow(/inertie/i);
  });
});
