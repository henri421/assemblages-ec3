import { describe, expect, it } from 'vitest';

import { verifierAssemblage, type DonneesAssemblage } from '../../src/domaines/verifier-assemblage';
import { ec3Recommande } from '../../src/norms/ec3-recommande';
import { serialiser } from '../../src/persistance/format-modele';
import { lireModele } from '../../src/persistance/parse';
import { chaiseDeReference } from '../fixtures/chaise';

function donnees(): DonneesAssemblage {
  return {
    assemblage: chaiseDeReference(),
    materiau: { nuance: 'S235', qualiteZ: 'Z15' },
    actions: { N_ELU: 1000, P_blocage: 600 },
    profil: ec3Recommande(),
    conditionsSoudage: { forme: 'angle-multipasse', bridage: 'faible', prechauffage: false },
    delta_lim: 0.5,
  };
}

describe('serialiser puis lireModele', () => {
  it('aller-retour sans perte, meme verdict', () => {
    const d = donnees();
    const relu = lireModele(serialiser('chaise-ancrage', d));
    expect(relu.detail).toBe('chaise-ancrage');
    expect(relu.donnees).toEqual(JSON.parse(JSON.stringify(d)));
    expect(verifierAssemblage(relu.donnees).taux).toEqual(verifierAssemblage(d).taux);
  });
});

describe('lireModele — refus motives', () => {
  it('pas du JSON', () => {
    expect(() => lireModele('{')).toThrow(/JSON/);
  });

  it('mauvais format', () => {
    expect(() => lireModele('{"format":"autre","version":1}')).toThrow(/format/);
  });

  it('version future', () => {
    expect(() => lireModele('{"format":"assemblages-ec3","version":2}')).toThrow(/Version/);
  });

  it('champ manquant nomme par son chemin', () => {
    const f = JSON.parse(serialiser('chaise-ancrage', donnees()));
    delete f.donnees.assemblage.platine.t;
    expect(() => lireModele(JSON.stringify(f))).toThrow(/platine\.t/);
  });

  it('nuance inconnue', () => {
    const f = JSON.parse(serialiser('chaise-ancrage', donnees()));
    f.donnees.materiau.nuance = 'S999';
    expect(() => lireModele(JSON.stringify(f))).toThrow(/nuance/);
  });
});
