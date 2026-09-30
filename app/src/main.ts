/**
 * Cablage de l'interface.
 *
 * Ce module ne calcule RIEN : il construit le formulaire depuis le schema de
 * `form`, lit les champs, appelle le noyau par `calcul`, et confie a `view`,
 * `draw` et `export` — tous purs et testes — la mise en forme. Il ajoute
 * seulement le branchement des evenements et la gestion de ce qui reste
 * affiche quand le calcul echoue.
 */

import { lireModele, serialiser, type Modele } from '../../src/index';
import { assistance, calculer, type Calcul } from './calcul';
import { dessinsDuCalcul } from './draw';
import { noteDeCalculHtml, resultatsEnCsv, svgAutonome } from './export';
import { echapper } from './format';
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
import { lireFichier, memoriser, relire, telecharger } from './storage';
import {
  blocsDuCalcul,
  htmlAssistance,
  htmlCordons,
  htmlDispositions,
  htmlTaux,
  messageDErreur,
  rendreResultat,
  titreDuVerdict,
  type Bloc,
} from './view';
import './style.css';

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

/** Valeurs saisies, par outil : changer de detail ne perd pas la saisie. */
const saisies = new Map<Outil, Valeurs>();
let outil: Outil = 'chaise-ancrage';
let dernier: Calcul | null = null;

choixOutil.innerHTML = OUTILS.map((o) => `<option value="${o.id}">${echapper(o.nom)}</option>`).join('');

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
  description.textContent = OUTILS.find((o) => o.id === outil)?.description ?? '';
  formulaire.innerHTML = FORMULAIRES[outil]
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
              ? `<select ${attr}>${(c.options ?? []).map(([val, lib]) => `<option value="${val}">${echapper(lib)}</option>`).join('')}</select>`
              : `<input type="text" inputmode="decimal" ${attr}${c.facultatif ? ' placeholder="facultatif"' : ''} />`;
          return `<label data-ligne="${c.cle}"><span>${c.libelle}${unite}</span>${entree}</label>`;
        })
        .join('');
      return `<fieldset data-groupe="${i}"><legend>${echapper(g.titre)}</legend>${champs}</fieldset>`;
    })
    .join('');
  for (const el of Array.from(formulaire.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-champ]'))) {
    const cle = el.dataset.champ ?? '';
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v[cle] === 'oui';
    else el.value = v[cle] ?? '';
  }
  limites.textContent = `Hypotheses et limites : ${hypotheses(outil).join(' ')}`;
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
  banniereErreur.textContent = message;
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
  corpsAssistance.innerHTML = htmlAssistance(d);
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
    corpsDessins.innerHTML = dessinsDuCalcul(c)
      .map((d) => `<figure><figcaption>${echapper(d.titre)}</figcaption>${d.svg}<p class="legende">${echapper(d.legende)}</p></figure>`)
      .join('');
    const alertes = avertissements(c).map((a) => `<p class="alerte">${echapper(a)}</p>`).join('');
    corpsResultat.innerHTML = alertes + rendreResultat(c);
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

// --- Sorties ---------------------------------------------------------------

function baseDeNom(c: Calcul): string {
  return `assemblages-ec3-${c.detail === 'te' ? c.modele.donnees.nature : c.detail}`;
}

/** Les donnees d'entree, telles que saisies, sous forme de blocs. */
function blocsDEntree(): Bloc[] {
  const v = valeurs();
  return FORMULAIRES[outil]
    .map((g) => ({
      titre: g.titre,
      lignes: g.champs
        .filter((c) => estVisible(g, c, v))
        .map((c) => ({
          symbole: c.cle,
          libelle: c.libelle.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ''),
          valeur:
            c.type === 'case'
              ? v[c.cle] === 'oui' ? 'oui' : 'non'
              : c.type === 'choix'
                ? (c.options?.find(([val]) => val === v[c.cle])?.[1] ?? v[c.cle] ?? '')
                : (v[c.cle] ?? '') === '' ? 'non saisi' : `${v[c.cle]}${c.unite === '' || c.unite === '-' ? '' : ` ${c.unite}`}`,
        })),
      note: null,
    }))
    .filter((b) => b.lignes.length > 0);
}

function sansCalcul(): void {
  afficherErreur('Aucun calcul valide a exporter : corriger la saisie, puis reessayer.');
}

function exporterNote(c: Calcul): void {
  const nom = OUTILS.find((o) => o.id === outil)?.nom ?? outil;
  const html = noteDeCalculHtml({
    titre: nom,
    date: new Date().toISOString().slice(0, 10),
    entrees: blocsDEntree(),
    dessins: dessinsDuCalcul(c),
    verdict: titreDuVerdict(c.resultat.verdict),
    motif: c.resultat.motif,
    tableaux: [
      { titre: 'Taux de travail', html: htmlTaux(c.resultat.taux) },
      { titre: 'Cordons', html: htmlCordons(c) },
      { titre: 'Dispositions constructives', html: htmlDispositions(c.resultat.dispositions) },
    ],
    resultats: blocsDuCalcul(c),
    avertissements: avertissements(c),
    hypotheses: hypotheses(outil),
  });
  const fichier = `${baseDeNom(c)}-note.html`;
  // L'ouverture d'onglet est souvent bloquee : un bouton qui ne fait rien
  // sans rien dire est pire qu'un telechargement inattendu.
  let onglet: Window | null = null;
  try {
    onglet = window.open('', '_blank') ?? null;
  } catch {
    onglet = null;
  }
  if (onglet === null) {
    telecharger(fichier, html, 'text/html;charset=utf-8');
    return;
  }
  try {
    onglet.document.write(html);
    onglet.document.close();
  } catch {
    telecharger(fichier, html, 'text/html;charset=utf-8');
  }
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
  if (action === 'exporter-dessins') {
    dessinsDuCalcul(c).forEach((d, i) =>
      telecharger(`${baseDeNom(c)}-${i + 1}.svg`, svgAutonome(d.svg), 'image/svg+xml;charset=utf-8'),
    );
  } else if (action === 'exporter-resultats') {
    telecharger(`${baseDeNom(c)}-resultats.csv`, resultatsEnCsv([...blocsDEntree(), ...blocsDuCalcul(c)]), 'text/csv;charset=utf-8');
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
