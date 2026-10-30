/**
 * Cablage de l'interface.
 *
 * Ce module ne calcule RIEN : il construit le formulaire depuis le schema de
 * `form`, lit les champs, appelle le noyau par `calcul`, et confie a `view`,
 * `draw` et `export` — tous purs et testes — la mise en forme. Il ajoute
 * seulement le branchement des evenements et la gestion de ce qui reste
 * affiche quand le calcul echoue.
 */

import { blocsEnTexte, definirLangue, langueDuDocument, noteDeCalculHtml } from 'aedificium-ui';
import { notationHtml, notationTexte } from './accents';
import { lireModele, serialiser, type Modele } from '../../src/index';
import { assistance, calculer, type Calcul } from './calcul';
import { dessinsDuCalcul } from './draw';
import { STYLES_TRACE, resultatsEnCsv, svgAutonome } from './export';
import {
  FORMULAIRES,
  OUTILS,
  estVisible,
  lireSaisie,
  valeursDepuisModele,
  valeursParDefaut,
  type Outil,
  type Valeurs,
} from './form';
import { avertissements, hypotheses } from './hypotheses';
import { blocsDEntree, noteDuCalcul } from './sorties';
import { lireFichier, memoriser, ouvrirOuTelecharger, relire, telecharger } from './storage';
import { blocsDuCalcul, htmlAssistance, messageDErreur, rendreResultat } from './view';
import { tr, trBlocs, trHtml } from './textes';
import './style.css';

definirLangue(langueDuDocument(document));

function exige<T extends Element>(selecteur: string): T {
  const trouve = document.querySelector(selecteur);
  if (trouve === null) throw new Error(`element absent de la page : ${selecteur}`);
  return trouve as T;
}

const choixOutil = exige<HTMLSelectElement>('[data-role="outil"]');
const description = exige<HTMLElement>('[data-role="description"]');
const formulaire = exige<HTMLFormElement>('[data-role="formulaire"]');
const blocAssistance = exige<HTMLElement>('[data-role="assistance"]');
const corpsAssistance = exige<HTMLElement>('[data-role="assistance-corps"]');
const corpsDessins = exige<HTMLElement>('[data-role="dessins-corps"]');
const corpsResultat = exige<HTMLElement>('[data-role="resultat-corps"]');
const banniereErreur = exige<HTMLElement>('[data-role="erreur"]');
const limites = exige<HTMLElement>('[data-role="limites"]');
const entreeFichier = exige<HTMLInputElement>('[data-role="fichier"]');
const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');
const voletSorties = exige<HTMLElement>('#sorties');

/** Valeurs saisies, par outil : changer de detail ne perd pas la saisie. */
const saisies = new Map<Outil, Valeurs>();
let outil: Outil = 'chaise-ancrage';
let dernier: Calcul | null = null;

choixOutil.innerHTML = trHtml(OUTILS.map((o) => `<option value="${o.id}">${notationTexte(o.nom)}</option>`).join(''));

function valeurs(): Valeurs {
  let v = saisies.get(outil);
  if (v === undefined) {
    v = valeursParDefaut(outil);
    saisies.set(outil, v);
  }
  return v;
}

/** Construit le formulaire du detail courant depuis son schema. */
function construireFormulaire(): void {
  const v = valeurs();
  description.textContent = tr(notationTexte(OUTILS.find((o) => o.id === outil)?.description ?? ''));
  formulaire.innerHTML = trHtml(
    FORMULAIRES[outil]
    .map((g, i) => {
      const champs = g.champs
        .map((c) => {
          const attr = `data-champ="${c.cle}"`;
          if (c.type === 'case') {
            return `<label class="case" data-ligne="${c.cle}"><input type="checkbox" ${attr} /><span>${c.libelle}</span></label>`;
          }
          const unite = c.unite === '' || c.unite === '-' ? '' : ` (${c.unite})`;
          const entree =
            c.type === 'choix'
              ? `<select ${attr}>${(c.options ?? []).map(([val, lib]) => `<option value="${val}">${notationTexte(lib)}</option>`).join('')}</select>`
              : `<input type="text" inputmode="decimal" ${attr}${c.facultatif ? ' placeholder="facultatif"' : ''} />`;
          return `<label data-ligne="${c.cle}"><span>${c.libelle}${unite}</span>${entree}</label>`;
        })
        .join('');
      return `<fieldset data-groupe="${i}"><legend>${notationHtml(g.titre)}</legend>${champs}</fieldset>`;
    })
    .join(''),
  );
  for (const el of Array.from(formulaire.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-champ]'))) {
    const cle = el.dataset.champ ?? '';
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v[cle] === 'oui';
    else el.value = v[cle] ?? '';
  }
  limites.textContent = tr(notationTexte(`Hypothèses et limites : ${hypotheses(outil).join(' ')}`));
  ajusterVisibilite();
}

/** Masque les champs sans objet, pour ne pas demander ce qui n'est pas lu. */
function ajusterVisibilite(): void {
  const v = valeurs();
  FORMULAIRES[outil].forEach((g, i) => {
    const fs = formulaire.querySelector<HTMLElement>(`[data-groupe="${i}"]`);
    if (fs === null) return;
    fs.hidden = !(g.visible?.(v) ?? true);
    for (const c of g.champs) {
      const ligne = fs.querySelector<HTMLElement>(`[data-ligne="${c.cle}"]`);
      if (ligne !== null) ligne.hidden = !estVisible(g, c, v);
    }
  });
}

function lireChamps(): void {
  const v = valeurs();
  for (const el of Array.from(formulaire.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-champ]'))) {
    const cle = el.dataset.champ ?? '';
    v[cle] = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.checked ? 'oui' : 'non') : el.value;
  }
}

function afficherErreur(message: string): void {
  banniereErreur.textContent = tr(notationTexte(message));
  banniereErreur.hidden = false;
}

function effacerErreur(): void {
  banniereErreur.textContent = '';
  banniereErreur.hidden = true;
}

function afficherAssistance(modele: Modele | null): void {
  let d = null;
  try {
    d = modele === null ? null : assistance(modele);
  } catch {
    d = null;
  }
  blocAssistance.hidden = d === null;
  corpsAssistance.innerHTML = trHtml(htmlAssistance(d));
}

/**
 * Recalcule et repeint.
 *
 * En cas d'echec, on montre l'erreur et on LAISSE EN PLACE le dernier
 * resultat valide : effacer la page a chaque frappe intermediaire rendrait
 * la saisie illisible, et un resultat perime sous une erreur bien visible
 * vaut mieux qu'un ecran blanc.
 */
function rafraichir(): void {
  lireChamps();
  ajusterVisibilite();
  const lecture = lireSaisie(outil, valeurs());
  if (!lecture.ok) {
    afficherErreur(lecture.message);
    return;
  }
  afficherAssistance(lecture.modele);
  try {
    const c = calculer(lecture.modele);
    corpsDessins.innerHTML = trHtml(dessinsDuCalcul(c)
      .map(
        (d, i) =>
          `<figure><figcaption>${notationHtml(d.titre)}</figcaption>${d.svg}<p class="legende">${notationHtml(d.legende)}</p>` +
          `<button type="button" data-action="exporter-dessin" data-dessin="${i}">${notationHtml(d.titre)} (SVG)</button></figure>`
      )
      .join(''));
    const alertes = avertissements(c).map((a) => `<p class="alerte">${notationHtml(a)}</p>`).join('');
    corpsResultat.innerHTML = trHtml(alertes + rendreResultat(c));
    dernier = c;
    memoriser(serialiser(lecture.modele));
    effacerErreur();
  } catch (erreur) {
    afficherErreur(messageDErreur(erreur));
  }
}

function changerOutil(nouveau: Outil): void {
  outil = nouveau;
  choixOutil.value = nouveau;
  construireFormulaire();
  rafraichir();
}

// --- Cartouche ---------------------------------------------------------------
// Le projet et l'element nomment la note. Ces champs vivent hors du formulaire
// de saisie : les remplir ne relance pas le calcul. Ils sont retenus d'une
// visite a l'autre et ne bloquent jamais l'application si le stockage refuse.

const CLE_CARTOUCHE = 'assemblages-ec3:cartouche';

function lireCartouche(): { projet: string; element: string } {
  try {
    const brut = localStorage.getItem(CLE_CARTOUCHE);
    if (brut === null) return { projet: '', element: '' };
    const lu: unknown = JSON.parse(brut);
    if (typeof lu !== 'object' || lu === null) return { projet: '', element: '' };
    const o = lu as Record<string, unknown>;
    return {
      projet: typeof o.projet === 'string' ? o.projet : '',
      element: typeof o.element === 'string' ? o.element : '',
    };
  } catch {
    return { projet: '', element: '' };
  }
}

function memoriserCartouche(): void {
  try {
    localStorage.setItem(
      CLE_CARTOUCHE,
      JSON.stringify({ projet: champProjet.value, element: champElement.value }),
    );
  } catch {
    // Stockage indisponible : le cartouche reste dans la page.
  }
}

const cartouche = lireCartouche();
champProjet.value = cartouche.projet;
champElement.value = cartouche.element;
voletSorties.addEventListener('input', memoriserCartouche);

// --- Sorties ---------------------------------------------------------------

function baseDeNom(c: Calcul): string {
  return `assemblages-ec3-${c.detail === 'te' ? c.modele.donnees.nature : c.detail}`;
}

function sansCalcul(): void {
  afficherErreur('Aucun calcul valide à exporter : corriger la saisie, puis réessayer.');
}

function exporterNote(c: Calcul): void {
  const html = noteDeCalculHtml(
    noteDuCalcul(outil, valeurs(), c, {
      projet: champProjet.value,
      element: champElement.value,
      date: new Date().toISOString().slice(0, 10),
    }),
    STYLES_TRACE,
  );
  ouvrirOuTelecharger(`${baseDeNom(c)}-note.html`, html);
}

document.addEventListener('click', (evenement) => {
  const cible = evenement.target;
  if (!(cible instanceof HTMLElement)) return;
  const action = cible.dataset.action;
  if (action === undefined) return;

  if (action === 'enregistrer') {
    const lecture = lireSaisie(outil, valeurs());
    if (!lecture.ok) return afficherErreur(lecture.message);
    telecharger(`assemblages-ec3-${outil}.json`, serialiser(lecture.modele), 'application/json;charset=utf-8');
    return;
  }
  if (action === 'ouvrir') return entreeFichier.click();
  if (action === 'reinitialiser') {
    saisies.set(outil, valeursParDefaut(outil));
    return changerOutil(outil);
  }
  if (!action.startsWith('exporter-')) return;
  if (dernier === null) return sansCalcul();
  const c = dernier;
  // Un dessin par bouton, place sous chaque figure : plusieurs telechargements
  // lances d'un meme clic, les navigateurs bloquent ceux qui suivent le premier.
  if (action === 'exporter-dessin') {
    const i = Number(cible.dataset.dessin);
    const d = dessinsDuCalcul(c)[i];
    if (d !== undefined) telecharger(`${baseDeNom(c)}-${i + 1}.svg`, svgAutonome(trHtml(d.svg)), 'image/svg+xml;charset=utf-8');
  } else if (action === 'exporter-resultats') {
    const blocs = [...blocsDEntree(outil, valeurs()), ...blocsDuCalcul(c)];
    telecharger(`${baseDeNom(c)}-resultats.csv`, resultatsEnCsv(blocsEnTexte(trBlocs(blocs))), 'text/csv;charset=utf-8');
  } else if (action === 'exporter-note') {
    exporterNote(c);
  }
});

/** Charge un modele relu : il remplace la saisie de son detail. */
function chargerModele(m: Modele): void {
  const { outil: o, valeurs: v } = valeursDepuisModele(m);
  saisies.set(o, v);
  changerOutil(o);
}

entreeFichier.addEventListener('change', () => {
  const fichier = entreeFichier.files?.[0];
  if (fichier === undefined) return;
  lireFichier(fichier)
    .then((texte) => chargerModele(lireModele(texte)))
    .catch((e: unknown) => afficherErreur(e instanceof Error ? e.message : 'Fichier illisible.'))
    .finally(() => {
      entreeFichier.value = '';
    });
});

choixOutil.addEventListener('change', () => changerOutil(choixOutil.value as Outil));
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);

// Demarrage : un detail demande dans l'adresse (?detail=te), sinon le dernier
// modele memorise, sinon la tete d'ancrage de reference.
const demande = new URLSearchParams(window.location.search).get('detail');
const memoire = relire();
let demarre = false;
if (demande !== null && OUTILS.some((o) => o.id === demande)) {
  changerOutil(demande as Outil);
  demarre = true;
} else if (memoire !== null) {
  try {
    chargerModele(lireModele(memoire));
    demarre = true;
  } catch {
    demarre = false;
  }
}
if (!demarre) changerOutil('chaise-ancrage');

// Hors navigateur (tests), pas de service worker.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
