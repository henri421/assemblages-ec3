/**
 * Dessins de la tete d'ancrage : tirant dessine, cotes et etiquettes lisibles.
 */
import { describe, expect, it } from 'vitest';

import { calculer } from '../../app/src/calcul';
import { dessinsDuCalcul } from '../../app/src/draw';
import { lireSaisie, valeursParDefaut } from '../../app/src/form';

function dessins(modif: Record<string, string> = {}) {
  const r = lireSaisie('chaise-ancrage', { ...valeursParDefaut('chaise-ancrage'), ...modif });
  if (!r.ok) throw new Error(r.message);
  return dessinsDuCalcul(calculer(r.modele));
}

const sansBalises = (s: string): string => s.replace(/<[^>]+>/g, '');

describe("dessins de la tete d'ancrage", () => {
  it('la vue en plan cote b, h et e, et nomme ses pieces', () => {
    const plan = sansBalises(dessins()[0].svg);
    for (const m of ['b = 300', 'h = 300', 'e = 220', 'Platine', 'Âme', "Couronne d'appui, Ø D = 150", 'Perçage, Ø d₀ = 80', 'Contour efficace'])
      expect(plan, m).toContain(m);
  });

  it('la coupe dessine le tirant et son ecrou, cote h_w, t et e', () => {
    const coupe = sansBalises(dessins()[1].svg);
    for (const m of ['Tirant', 'Écrou', "Bloc d'ancrage", 'Cordon, a = 10', 'hw = 150', 't = 30', 'e = 220', 'Support en béton'])
      expect(coupe, m).toContain(m);
  });

  it('en appui aux extremites, la ligne d appui est nommee avec L', () => {
    const plan = sansBalises(dessins({ schema: 'appui-extremites', type_appui: 'lierne-acier' })[0].svg);
    expect(plan).toMatch(/Ligne d'appui, L = \d/);
    expect(plan).not.toContain('Contour efficace');
  });

  it('le texte des dessins est dans le cadre', () => {
    for (const d of dessins()) {
      const [x, y, w, h] = (/viewBox="([^"]+)"/.exec(d.svg)?.[1] ?? '').split(' ').map(Number);
      for (const m of d.svg.matchAll(/<text[^>]* x="([-\d.]+)" y="([-\d.]+)"/g)) {
        const tx = Number(m[1]);
        const ty = Number(m[2]);
        expect(tx).toBeGreaterThanOrEqual(x);
        expect(tx).toBeLessThanOrEqual(x + w);
        expect(ty).toBeGreaterThanOrEqual(y);
        expect(ty).toBeLessThanOrEqual(y + h);
      }
    }
  });
});
