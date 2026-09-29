import { describe, expect, it } from 'vitest';

import { gouvernant, sansObjet, taux, trierTaux } from '../../src/domaines/taux-de-travail';

describe('trierTaux', () => {
  it('decroissant, les sans-objet a la fin dans leur ordre', () => {
    const l = trierTaux([
      sansObjet('x', 'c', 'x', 'motif x'),
      taux('a', 'c', 'a', 0.4),
      taux('b', 'c', 'b', 0.9),
      sansObjet('y', 'c', 'y', 'motif y'),
    ]);
    expect(l.map((t) => t.id)).toEqual(['b', 'a', 'x', 'y']);
  });
});

describe('gouvernant', () => {
  it('ignore le service et les sans-objet', () => {
    const l = [taux('a', 'c', 'a', 0.4), taux('s', 'c', 's', 2, 'service'), sansObjet('x', 'c', 'x', 'm')];
    expect(gouvernant(l)?.id).toBe('a');
    expect(gouvernant(l, 'service')?.id).toBe('s');
    expect(gouvernant([])).toBeNull();
  });
});
