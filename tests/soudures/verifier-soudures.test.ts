import { describe, expect, it } from 'vitest';

import { fluxDansLesCordons } from '../../src/soudures/flux';
import { gorgePleineResistance } from '../../src/soudures/pleine-resistance';
import { verifierSoudures } from '../../src/soudures/verifier-soudures';
import { chaiseDeReference } from '../fixtures/chaise';

const S235 = { f_u: 360, beta_w: 0.8, gamma_M2: 1.25 };
const PLEINE = gorgePleineResistance({
  t_w: 20, f_y: 235, f_u: 360, beta_w: 0.8, gamma_M0: 1, gamma_M2: 1.25,
});

describe('verifierSoudures — chaise de reference', () => {
  const flux = fluxDansLesCordons({
    assemblage: chaiseDeReference(), N_Ed: 1000, f_y_platine: 235, f_y_ame: 235,
  });
  const r = verifierSoudures(flux, 10, S235, PLEINE);

  it('le cordon interieur gouverne, en compression', () => {
    expect(r.gouvernant.cas.id).toBe('interieur');
    expect(r.gouvernant.directionnelle.sigma_perp).toBeCloseTo(-139.5694, 4);
    expect(r.gouvernant.directionnelle.contrainteEquivalente).toBeCloseTo(279.1388, 4);
    expect(r.taux).toBeCloseTo(0.775386, 6);
    expect(r.gouvernant.directionnelle.critereNormalApplicable).toBe(false);
  });

  it('les methodes ne coincident pas : un effort transversal existe', () => {
    expect(r.methodesCoincident).toBe(false);
  });
});

describe('verifierSoudures — contact direct', () => {
  it('le cordon exterieur, tendu par le moment local, active le second critere', () => {
    const a = chaiseDeReference();
    a.soudure.contactDirect = true;
    const flux = fluxDansLesCordons({ assemblage: a, N_Ed: 1000, f_y_platine: 235, f_y_ame: 235 });
    const r = verifierSoudures(flux, 10, S235, PLEINE);
    const ext = r.verifications.find((v) => v.cas.id === 'exterieur');
    // sigma_perp = 783,333 / (10 racine 2) = 55,3900 MPa ; taux 2 = 55,39 / 259,2 = 0,213696
    expect(ext?.directionnelle.sigma_perp).toBeCloseTo(55.39003, 4);
    expect(ext?.directionnelle.critereNormalApplicable).toBe(true);
    expect(ext?.directionnelle.tauxNormal).toBeCloseTo(0.213696, 5);
    expect(r.gouvernant.cas.id).toBe('exterieur');
  });
});

describe('verifierSoudures — cisaillement longitudinal pur', () => {
  it('signale la coincidence des deux methodes', () => {
    const flux = {
      ...fluxDansLesCordons({
        assemblage: chaiseDeReference(), N_Ed: 1000, f_y_platine: 235, f_y_ame: 235,
      }),
      cas: [
        { id: 'x', cordon: 'exterieur' as const, libelle: 'x', efforts: { p_1: 0, p_2: 0, p_para: 1 } },
      ],
    };
    const r = verifierSoudures(flux, 5, S235, PLEINE);
    expect(r.methodesCoincident).toBe(true);
    expect(r.gouvernant.simplifiee.taux).toBeCloseTo(r.taux, 12);
  });

  it('refuse une liste de cas vide', () => {
    const flux = {
      ...fluxDansLesCordons({
        assemblage: chaiseDeReference(), N_Ed: 1000, f_y_platine: 235, f_y_ame: 235,
      }),
      cas: [],
    };
    expect(() => verifierSoudures(flux, 5, S235, PLEINE)).toThrow(/Aucun cas/);
  });
});
