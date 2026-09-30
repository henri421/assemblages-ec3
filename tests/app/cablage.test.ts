import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

/**
 * Tests du CABLAGE : on charge la vraie page et le vrai module, et on verifie
 * que saisir une valeur change ce qui s'affiche. La logique pure est testee a
 * cote ; ici on ne teste que la jonction.
 */

const CHEMIN_HTML = fileURLToPath(new URL('../../app/index.html', import.meta.url));
const NOMS = ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'localStorage'];

async function monter(adresse = 'http://localhost/'): Promise<JSDOM> {
  const dom = new JSDOM(readFileSync(CHEMIN_HTML, 'utf8'), { url: adresse, pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.HTMLInputElement = dom.window.HTMLInputElement;
  g.HTMLSelectElement = dom.window.HTMLSelectElement;
  g.localStorage = dom.window.localStorage;
  vi.resetModules();
  await import('../../app/src/main');
  return dom;
}

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const n of NOMS) delete g[n];
});

function el<T extends Element>(dom: JSDOM, s: string): T {
  const e = dom.window.document.querySelector(s);
  if (e === null) throw new Error(`absent : ${s}`);
  return e as T;
}

function saisir(dom: JSDOM, cle: string, valeur: string): void {
  const e = el<HTMLInputElement>(dom, `[data-champ="${cle}"]`);
  e.value = valeur;
  e.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

describe('cablage', () => {
  it('s ouvre sur la tete d ancrage de reference, conforme', async () => {
    const dom = await monter();
    expect(el(dom, '[data-role="verdict"]').getAttribute('data-verdict')).toBe('conforme');
    expect(el(dom, '[data-role="dessins-corps"]').querySelectorAll('svg')).toHaveLength(2);
  });

  it('une saisie change le verdict', async () => {
    const dom = await monter();
    saisir(dom, 'N_ELU', '1500');
    expect(el(dom, '[data-role="verdict"]').getAttribute('data-verdict')).toBe('non-conforme-resistance');
  });

  it('une saisie invalide montre l erreur et garde le dernier resultat', async () => {
    const dom = await monter();
    saisir(dom, 't', 'abc');
    expect(el<HTMLElement>(dom, '[data-role="erreur"]').hidden).toBe(false);
    expect(el(dom, '[data-role="verdict"]').getAttribute('data-verdict')).toBe('conforme');
  });

  it('l assistance signale une disposition enfreinte en temps reel', async () => {
    const dom = await monter();
    saisir(dom, 'e', '190');
    expect(el(dom, '[data-role="assistance-corps"]').textContent).toMatch(/TA 2020/);
  });

  it('les champs sans objet sont masques', async () => {
    const dom = await monter();
    expect(el<HTMLElement>(dom, '[data-ligne="t_w_lierne"]').hidden).toBe(true);
    const s = el<HTMLSelectElement>(dom, '[data-champ="type_appui"]');
    s.value = 'lierne-acier';
    s.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(el<HTMLElement>(dom, '[data-ligne="t_w_lierne"]').hidden).toBe(false);
  });

  it('le detail demande dans l adresse est ouvert', async () => {
    const dom = await monter('http://localhost/?detail=recouvrement');
    expect(el<HTMLSelectElement>(dom, '[data-role="outil"]').value).toBe('recouvrement');
    expect(el(dom, '[data-role="formulaire"]').querySelector('[data-champ="L_r"]')).not.toBeNull();
  });

  it('changer de detail conserve la saisie du precedent', async () => {
    const dom = await monter();
    saisir(dom, 'N_ELU', '900');
    const choix = el<HTMLSelectElement>(dom, '[data-role="outil"]');
    choix.value = 'te';
    choix.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    choix.value = 'chaise-ancrage';
    choix.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(el<HTMLInputElement>(dom, '[data-champ="N_ELU"]').value).toBe('900');
  });
});
