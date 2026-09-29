import { describe, expect, it } from 'vitest';

import { fluxDansLesCordons } from '../../src/soudures/flux';
import { gorgePleineResistance } from '../../src/soudures/pleine-resistance';
import { verifierSoudures } from '../../src/soudures/verifier-soudures';
import { AME_DE_REFERENCE, chaiseDeReference } from '../fixtures/chaise';

const S235 = { f_u: 360, beta_w: 0.8, gamma_M2: 1.25 };
const PLEINE = gorgePleineResistance({
  t_w: 20, f_y: 235, f_u: 360, beta_w: 0.8, gamma_M0: 1, gamma_M2: 1.25,
});
const COMMUN = { f_y_platine: 235, f_y_ame: 235, ame: AME_DE_REFERENCE };

describe('verifierSoudures — chaise de reference', () => {
  const flux = fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN });
  const r = verifierSoudures(flux, 10, S235, PLEINE);

  it('le cordon interieur gouverne, en traction', () => {
    expect(r.gouvernant.cas.id).toBe('interieur');
    const d = r.gouvernant.directionnelle;
    expect(d.sigma_perp).toBeCloseTo(139.5694, 4);
    expect(d.tau_para).toBeCloseTo(28.3269, 4);
    expect(d.contrainteEquivalente).toBeCloseTo(283.4179, 4);
    expect(r.taux).toBeCloseTo(0.787272, 6);
    expect(d.critereNormalApplicable).toBe(true);
    expect(d.tauxNormal).toBeCloseTo(0.538462, 6);
  });

  it('les methodes ne coincident pas : un effort transversal existe', () => {
    expect(r.methodesCoincident).toBe(false);
  });
});

describe('verifierSoudures — cisaillement longitudinal pur', () => {
  const flux = fluxDansLesCordons({ assemblage: chaiseDeReference(), N_Ed: 1000, ...COMMUN });

  it('signale la coincidence des deux methodes', () => {
    const pur = {
      ...flux,
      cas: [
        { id: 'x', cordon: 'interieur' as const, libelle: 'x', efforts: { p_1: 0, p_2: 0, p_para: 1 } },
      ],
    };
    const r = verifierSoudures(pur, 5, S235, PLEINE);
    expect(r.methodesCoincident).toBe(true);
    expect(r.gouvernant.simplifiee.taux).toBeCloseTo(r.taux, 12);
  });

  it('refuse une liste de cas vide', () => {
    expect(() => verifierSoudures({ ...flux, cas: [] }, 5, S235, PLEINE)).toThrow(/Aucun cas/);
  });
});
