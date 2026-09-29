/**
 * Relecture d un modele enregistre.
 *
 * Controle de STRUCTURE seulement : chaque champ attendu existe et a le bon
 * type. Les controles physiques (grandeur strictement positive, gorge
 * minimale...) restent ceux du noyau, qui les fera au calcul : les
 * dupliquer ici creerait deux verites.
 */

import type { DonneesAssemblage } from '../domaines/verifier-assemblage';
import { NUANCES, QUALITES_Z } from '../model/materiau';
import { FORMAT, VERSION, type FichierModele } from './format-modele';

type Objet = Record<string, unknown>;

function objet(v: unknown, chemin: string): Objet {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`Fichier invalide : ${chemin} doit etre un objet.`);
  }
  return v as Objet;
}

function nombre(o: Objet, cle: string, chemin: string): number {
  const v = o[cle];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Fichier invalide : ${chemin}.${cle} doit etre un nombre.`);
  }
  return v;
}

function nombreFacultatif(o: Objet, cle: string, chemin: string): number | undefined {
  return o[cle] === undefined ? undefined : nombre(o, cle, chemin);
}

function parmi<T extends string>(o: Objet, cle: string, valeurs: readonly T[], chemin: string): T {
  const v = o[cle];
  if (typeof v !== 'string' || !valeurs.includes(v as T)) {
    throw new Error(`Fichier invalide : ${chemin}.${cle} doit valoir ${valeurs.join(', ')}.`);
  }
  return v as T;
}

function booleen(o: Objet, cle: string, chemin: string): boolean {
  const v = o[cle];
  if (typeof v !== 'boolean') {
    throw new Error(`Fichier invalide : ${chemin}.${cle} doit etre vrai ou faux.`);
  }
  return v;
}

/** Relit le texte d un fichier de modele de tete d ancrage. */
export function lireModele(texte: string): FichierModele {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error('Fichier invalide : ce n est pas du JSON.');
  }
  const f = objet(brut, 'le fichier');
  if (f.format !== FORMAT) {
    throw new Error(`Fichier invalide : format attendu « ${FORMAT} ».`);
  }
  if (f.version !== VERSION) {
    throw new Error(`Version de fichier non prise en charge : ${String(f.version)} (attendue ${VERSION}).`);
  }
  if (f.detail !== 'chaise-ancrage') {
    throw new Error(`Type de detail inconnu : ${String(f.detail)}.`);
  }
  return { format: FORMAT, version: VERSION, detail: 'chaise-ancrage', donnees: lireChaise(objet(f.donnees, 'donnees')) };
}

function lireChaise(d: Objet): DonneesAssemblage {
  const a = objet(d.assemblage, 'donnees.assemblage');
  const pl = objet(a.platine, 'assemblage.platine');
  const pa = objet(a.plats, 'assemblage.plats');
  const so = objet(a.soudure, 'assemblage.soudure');
  const an = objet(a.ancrage, 'assemblage.ancrage');
  const ap = objet(a.appui, 'assemblage.appui');
  const m = objet(d.materiau, 'donnees.materiau');
  const ac = objet(d.actions, 'donnees.actions');

  const resultat: DonneesAssemblage = {
    assemblage: {
      platine: {
        b: nombre(pl, 'b', 'platine'),
        h: nombre(pl, 'h', 'platine'),
        t: nombre(pl, 't', 'platine'),
        d_0: nombre(pl, 'd_0', 'platine'),
      },
      plats: {
        t_w: nombre(pa, 't_w', 'plats'),
        h_w: nombre(pa, 'h_w', 'plats'),
        L_w: nombre(pa, 'L_w', 'plats'),
        e: nombre(pa, 'e', 'plats'),
        L: nombreFacultatif(pa, 'L', 'plats'),
      },
      soudure: {
        a: nombre(so, 'a', 'soudure'),
        l_eff: nombreFacultatif(so, 'l_eff', 'soudure'),
        contactDirect: booleen(so, 'contactDirect', 'soudure'),
      },
      ancrage: {
        D: nombre(an, 'D', 'ancrage'),
        excentrement: nombreFacultatif(an, 'excentrement', 'ancrage'),
        inclinaison: nombre(an, 'inclinaison', 'ancrage'),
      },
      appui: {
        type: parmi(ap, 'type', ['beton', 'lierne-acier'] as const, 'appui'),
        f_ck: nombreFacultatif(ap, 'f_ck', 'appui'),
        k_j: nombreFacultatif(ap, 'k_j', 'appui'),
        l_appui: nombreFacultatif(ap, 'l_appui', 'appui'),
        t_w_lierne: nombreFacultatif(ap, 't_w_lierne', 'appui'),
        h_w_lierne: nombreFacultatif(ap, 'h_w_lierne', 'appui'),
        t_f_lierne: nombreFacultatif(ap, 't_f_lierne', 'appui'),
        b_f_lierne: nombreFacultatif(ap, 'b_f_lierne', 'appui'),
      },
      schema: parmi(a, 'schema', ['appui-continu', 'appui-extremites'] as const, 'assemblage'),
    },
    materiau: {
      nuance: parmi(m, 'nuance', NUANCES, 'materiau'),
      qualiteZ: parmi(m, 'qualiteZ', QUALITES_Z, 'materiau'),
    },
    actions: {
      N_ELU: nombre(ac, 'N_ELU', 'actions'),
      P_p: nombreFacultatif(ac, 'P_p', 'actions'),
      F_tk: nombreFacultatif(ac, 'F_tk', 'actions'),
      P_blocage: nombreFacultatif(ac, 'P_blocage', 'actions'),
    },
  };

  if (d.profil !== undefined) {
    const p = objet(d.profil, 'donnees.profil');
    resultat.profil = {
      name: typeof p.name === 'string' ? p.name : 'profil importe',
      gamma_M0: nombre(p, 'gamma_M0', 'profil'),
      gamma_M1: nombre(p, 'gamma_M1', 'profil'),
      gamma_M2: nombre(p, 'gamma_M2', 'profil'),
      eta: nombre(p, 'eta', 'profil'),
      E: nombre(p, 'E', 'profil'),
      beta_j: nombre(p, 'beta_j', 'profil'),
      gamma_c: nombre(p, 'gamma_c', 'profil'),
    };
  }
  if (d.conditionsSoudage !== undefined) {
    const c = objet(d.conditionsSoudage, 'donnees.conditionsSoudage');
    resultat.conditionsSoudage = {
      forme: parmi(
        c,
        'forme',
        ['angle-monopasse', 'angle-multipasse', 'penetration-sequence', 'penetration', 'assemblage-angle'] as const,
        'conditionsSoudage',
      ),
      bridage: parmi(c, 'bridage', ['faible', 'moyen', 'fort'] as const, 'conditionsSoudage'),
      prechauffage: booleen(c, 'prechauffage', 'conditionsSoudage'),
    };
  }
  resultat.delta_lim = nombreFacultatif(d, 'delta_lim', 'donnees');
  return resultat;
}
