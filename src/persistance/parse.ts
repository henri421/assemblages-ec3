/**
 * Relecture d un modele enregistre.
 *
 * Controle de STRUCTURE seulement : chaque champ attendu existe et a le bon
 * type. Les controles physiques (grandeur strictement positive, gorge
 * minimale...) restent ceux du noyau, qui les fera au calcul : les
 * dupliquer ici creerait deux verites.
 */

import type { DonneesProfile } from '../details/profile-platine';
import type { DonneesRecouvrement } from '../details/recouvrement';
import type { DonneesTe } from '../details/te';
import type { DonneesAssemblage } from '../domaines/verifier-assemblage';
import type { ConditionsSoudage } from '../epaisseur/arrachement-lamellaire';
import { NUANCES, QUALITES_Z, type Materiau } from '../model/materiau';
import type { ProfilEC3 } from '../norms/ec3-recommande';
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

/** Relit le texte d un fichier de modele. */
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
  const donnees = objet(f.donnees, 'donnees');
  const entete = { format: FORMAT, version: VERSION } as const;
  switch (f.detail) {
    case 'chaise-ancrage':
      return { ...entete, detail: 'chaise-ancrage', donnees: lireChaise(donnees) };
    case 'te':
      return { ...entete, detail: 'te', donnees: lireTe(donnees) };
    case 'recouvrement':
      return { ...entete, detail: 'recouvrement', donnees: lireRecouvrement(donnees) };
    case 'profile-platine':
      return { ...entete, detail: 'profile-platine', donnees: lireProfile(donnees) };
    default:
      throw new Error(`Type de detail inconnu : ${String(f.detail)}.`);
  }
}

function lireMateriau(d: Objet): Materiau {
  const m = objet(d.materiau, 'donnees.materiau');
  return { nuance: parmi(m, 'nuance', NUANCES, 'materiau'), qualiteZ: parmi(m, 'qualiteZ', QUALITES_Z, 'materiau') };
}

function lireProfil(d: Objet): ProfilEC3 | undefined {
  if (d.profil === undefined) return undefined;
  const p = objet(d.profil, 'donnees.profil');
  return {
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

function lireConditions(d: Objet): ConditionsSoudage | undefined {
  if (d.conditionsSoudage === undefined) return undefined;
  const c = objet(d.conditionsSoudage, 'donnees.conditionsSoudage');
  return {
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

/** Ajoute les champs facultatifs communs sans ecrire de cle `undefined`. */
function avecCommuns<T extends object>(base: T, d: Objet): T {
  const profil = lireProfil(d);
  const conditions = lireConditions(d);
  return {
    ...base,
    ...(profil === undefined ? {} : { profil }),
    ...(conditions === undefined ? {} : { conditionsSoudage: conditions }),
  };
}

function lireTe(d: Objet): DonneesTe {
  const so = objet(d.soudure, 'donnees.soudure');
  const s = objet(d.sollicitations, 'donnees.sollicitations');
  const cotes = nombre(so, 'cotes', 'soudure');
  if (cotes !== 1 && cotes !== 2) {
    throw new Error('Fichier invalide : soudure.cotes doit valoir 1 ou 2.');
  }
  return avecCommuns(
    {
      nature: parmi(d, 'nature', ['te', 'cruciforme', 'angle'] as const, 'donnees'),
      t_p: nombre(d, 't_p', 'donnees'),
      L: nombre(d, 'L', 'donnees'),
      t_b: nombre(d, 't_b', 'donnees'),
      soudure: {
        type: parmi(so, 'type', ['angle', 'penetration-partielle', 'penetration-totale'] as const, 'soudure'),
        a: nombre(so, 'a', 'soudure'),
        cotes,
      },
      sollicitations: {
        N: nombre(s, 'N', 'sollicitations'),
        V_para: nombre(s, 'V_para', 'sollicitations'),
        V_perp: nombre(s, 'V_perp', 'sollicitations'),
        M_plan: nombre(s, 'M_plan', 'sollicitations'),
        M_hors: nombre(s, 'M_hors', 'sollicitations'),
      },
      materiau: lireMateriau(d),
    },
    d,
  );
}

function lireRecouvrement(d: Objet): DonneesRecouvrement {
  const c = objet(d.cordons, 'donnees.cordons');
  const s = objet(d.sollicitations, 'donnees.sollicitations');
  return avecCommuns(
    {
      b_p: nombre(d, 'b_p', 'donnees'),
      t_p: nombre(d, 't_p', 'donnees'),
      b_b: nombre(d, 'b_b', 'donnees'),
      t_b: nombre(d, 't_b', 'donnees'),
      L_r: nombre(d, 'L_r', 'donnees'),
      cordons: { lateraux: booleen(c, 'lateraux', 'cordons'), frontal: booleen(c, 'frontal', 'cordons') },
      a: nombre(d, 'a', 'donnees'),
      sollicitations: {
        N: nombre(s, 'N', 'sollicitations'),
        V: nombre(s, 'V', 'sollicitations'),
        M: nombre(s, 'M', 'sollicitations'),
      },
      materiau: lireMateriau(d),
    },
    d,
  );
}

function lireProfile(d: Objet): DonneesProfile {
  const s = objet(d.sollicitations, 'donnees.sollicitations');
  return avecCommuns(
    {
      h: nombre(d, 'h', 'donnees'),
      b: nombre(d, 'b', 'donnees'),
      t_w: nombre(d, 't_w', 'donnees'),
      t_f: nombre(d, 't_f', 'donnees'),
      a_f: nombre(d, 'a_f', 'donnees'),
      a_w: nombre(d, 'a_w', 'donnees'),
      t_platine: nombre(d, 't_platine', 'donnees'),
      sollicitations: {
        N: nombre(s, 'N', 'sollicitations'),
        V_y: nombre(s, 'V_y', 'sollicitations'),
        V_z: nombre(s, 'V_z', 'sollicitations'),
        M_y: nombre(s, 'M_y', 'sollicitations'),
        M_z: nombre(s, 'M_z', 'sollicitations'),
      },
      materiau: lireMateriau(d),
    },
    d,
  );
}

function lireChaise(d: Objet): DonneesAssemblage {
  const a = objet(d.assemblage, 'donnees.assemblage');
  const pl = objet(a.platine, 'assemblage.platine');
  const pa = objet(a.plats, 'assemblage.plats');
  const so = objet(a.soudure, 'assemblage.soudure');
  const an = objet(a.ancrage, 'assemblage.ancrage');
  const ap = objet(a.appui, 'assemblage.appui');
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
    materiau: lireMateriau(d),
    actions: {
      N_ELU: nombre(ac, 'N_ELU', 'actions'),
      P_p: nombreFacultatif(ac, 'P_p', 'actions'),
      F_tk: nombreFacultatif(ac, 'F_tk', 'actions'),
      P_blocage: nombreFacultatif(ac, 'P_blocage', 'actions'),
    },
  };

  const delta_lim = nombreFacultatif(d, 'delta_lim', 'donnees');
  return avecCommuns({ ...resultat, ...(delta_lim === undefined ? {} : { delta_lim }) }, d);
}
