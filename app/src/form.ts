/**
 * Saisie : schema declaratif des formulaires, valeurs par defaut, et
 * traduction des champs en modele du noyau.
 *
 * Module PUR : il ne connait ni le document ni les elements de formulaire.
 * Le cablage lui passe des chaines, il rend un modele ou un refus motive.
 *
 * Unites de l'interface : longueurs en mm, efforts en kN, moments en kN.m,
 * contraintes en MPa, angles en degres.
 */

import { ec3Recommande, type Modele, type ProfilEC3 } from '../../src/index';
import { lireNombre } from './format';

export type Outil = 'chaise-ancrage' | 'te' | 'cruciforme' | 'angle' | 'recouvrement' | 'profile-platine';

export const OUTILS: ReadonlyArray<{ id: Outil; nom: string; description: string }> = [
  { id: 'chaise-ancrage', nom: "Tete d'ancrage de tirant", description: 'platine raidie par deux ames, sur beton ou sur lierne' },
  { id: 'te', nom: 'Te soude', description: 'plat soude perpendiculairement sur une platine' },
  { id: 'cruciforme', nom: 'Cruciforme', description: 'deux plats de part et d autre d un plat traversant' },
  { id: 'angle', nom: "Assemblage d'angle", description: 'plat soude au bord d une autre piece' },
  { id: 'recouvrement', nom: 'Recouvrement', description: 'plat sur plat, cordons lateraux et frontal' },
  { id: 'profile-platine', nom: 'Profile sur platine', description: 'profile en I soude sur une platine' },
];

export type Valeurs = Record<string, string>;

export interface Champ {
  cle: string;
  /** Libelle, HTML admis (indices). */
  libelle: string;
  unite: string;
  type: 'nombre' | 'choix' | 'case';
  options?: ReadonlyArray<readonly [string, string]>;
  /** Un champ facultatif vide vaut « non saisi ». */
  facultatif?: boolean;
  /** Condition d'affichage ; un champ masque n'est pas lu. */
  visible?: (v: Valeurs) => boolean;
}

export interface Groupe {
  titre: string;
  champs: Champ[];
  visible?: (v: Valeurs) => boolean;
}

const nombre = (cle: string, libelle: string, unite: string, extra: Partial<Champ> = {}): Champ => ({
  cle,
  libelle,
  unite,
  type: 'nombre',
  ...extra,
});

const NUANCES_OPTIONS = [
  ['S235', 'S235'],
  ['S275', 'S275'],
  ['S355', 'S355'],
  ['S420', 'S420'],
  ['S460', 'S460'],
] as const;

const GROUPE_MATERIAU: Groupe = {
  titre: 'Materiau',
  champs: [
    { cle: 'nuance', libelle: 'Nuance', unite: '', type: 'choix', options: NUANCES_OPTIONS },
    {
      cle: 'qualiteZ',
      libelle: "Qualite dans l'epaisseur (EN 10164)",
      unite: '',
      type: 'choix',
      options: [
        ['aucune', 'aucune'],
        ['Z15', 'Z15'],
        ['Z25', 'Z25'],
        ['Z35', 'Z35'],
      ],
    },
  ],
};

const GROUPE_SOUDAGE: Groupe = {
  titre: 'Soudage (arrachement lamellaire)',
  champs: [
    {
      cle: 'forme',
      libelle: 'Forme de la soudure',
      unite: '',
      type: 'choix',
      options: [
        ['angle-monopasse', "cordon d'angle monopasse (Z_b = -5)"],
        ['angle-multipasse', "cordon d'angle multipasse (Z_b = 0)"],
        ['penetration-sequence', 'penetration, sequence adaptee (Z_b = 3)'],
        ['penetration', 'penetration (Z_b = 5)'],
        ['assemblage-angle', "assemblage d'angle (Z_b = 8)"],
      ],
    },
    {
      cle: 'bridage',
      libelle: 'Bridage du retrait',
      unite: '',
      type: 'choix',
      options: [
        ['faible', 'faible, retrait libre (Z_d = 0)'],
        ['moyen', 'moyen (Z_d = 3)'],
        ['fort', 'fort, retrait empeche (Z_d = 5)'],
      ],
    },
    { cle: 'prechauffage', libelle: 'prechauffage >= 100 degres C (Z_e = -8)', unite: '', type: 'case' },
  ],
};

function groupeCoefficients(avecBeton: boolean): Groupe {
  return {
    titre: 'Coefficients',
    champs: [
      nombre('gamma_M0', '&gamma;<sub>M0</sub>', '-'),
      nombre('gamma_M1', '&gamma;<sub>M1</sub>', '-'),
      nombre('gamma_M2', '&gamma;<sub>M2</sub>', '-'),
      ...(avecBeton ? [nombre('gamma_c', '&gamma;<sub>c</sub> (beton)', '-', { visible: (v: Valeurs) => v.type_appui === 'beton' })] : []),
    ],
  };
}

const extremites = (v: Valeurs): boolean => v.schema === 'appui-extremites';
const beton = (v: Valeurs): boolean => v.type_appui === 'beton';
const lierne = (v: Valeurs): boolean => v.type_appui === 'lierne-acier';

const CHAISE: Groupe[] = [
  {
    titre: 'Platine',
    champs: [
      nombre('b', 'b, perpendiculaire aux ames', 'mm'),
      nombre('h', 'h, parallele aux ames', 'mm'),
      nombre('t', 't, epaisseur', 'mm'),
      nombre('d_0', 'd<sub>0</sub>, percage', 'mm'),
    ],
  },
  {
    titre: 'Ames (raidisseurs)',
    champs: [
      nombre('t_w', 't<sub>w</sub>, epaisseur', 'mm'),
      nombre('h_w', 'h<sub>w</sub>, hauteur', 'mm'),
      nombre('L_w', 'L<sub>w</sub>, longueur', 'mm'),
      nombre('e', 'e, entraxe', 'mm'),
    ],
  },
  {
    titre: 'Cordons ame-platine',
    champs: [
      nombre('a', 'a, gorge', 'mm'),
      nombre('l_eff', 'l<sub>eff</sub> (vide : L<sub>w</sub>)', 'mm', { facultatif: true }),
      { cle: 'contactDirect', libelle: 'contact direct prescrit et controle', unite: '', type: 'case' },
    ],
  },
  {
    titre: "Tete d'ancrage",
    champs: [
      nombre('D', 'D, couronne d appui', 'mm'),
      nombre('excentrement', 'excentrement du tirant', 'mm', { facultatif: true }),
      nombre('inclinaison', 'inclinaison / normale', 'degres'),
    ],
  },
  {
    titre: 'Appui',
    champs: [
      {
        cle: 'schema',
        libelle: 'Schema',
        unite: '',
        type: 'choix',
        options: [
          ['appui-continu', 'platine portee sur toute sa surface'],
          ['appui-extremites', 'platine portee a ses extremites'],
        ],
      },
      {
        cle: 'type_appui',
        libelle: 'Support',
        unite: '',
        type: 'choix',
        options: [
          ['beton', 'beton'],
          ['lierne-acier', 'lierne (profil acier)'],
        ],
      },
      nombre('L', 'L, portee dans le sens des ames', 'mm', { visible: extremites }),
      nombre('f_ck', 'f<sub>ck</sub>', 'MPa', { visible: beton }),
      nombre('k_j', 'k<sub>j</sub>, concentration (1 a 3)', '-', { visible: beton }),
      nombre('l_appui', "l<sub>appui</sub>, longueur d'appui de chaque extremite", 'mm', {
        visible: (v) => extremites(v) && beton(v),
      }),
      nombre('t_w_lierne', 'lierne : t<sub>w</sub>', 'mm', { visible: lierne }),
      nombre('h_w_lierne', 'lierne : h<sub>w</sub> entre semelles', 'mm', { visible: lierne }),
      nombre('t_f_lierne', 'lierne : t<sub>f</sub>', 'mm', { visible: lierne }),
      nombre('b_f_lierne', 'lierne : b<sub>f</sub>', 'mm', { visible: lierne }),
    ],
  },
  {
    titre: 'Actions',
    champs: [
      nombre('N_ELU', 'N<sub>ELU</sub>, calcul de la paroi', 'kN'),
      nombre('P_p', "P<sub>p</sub>, traction d'epreuve", 'kN', { facultatif: true }),
      nombre('F_tk', "F<sub>tk</sub>, resistance de l'armature", 'kN', { facultatif: true }),
      nombre('P_blocage', 'P<sub>blocage</sub>, pour le service', 'kN', { facultatif: true }),
      nombre('delta_lim', 'fleche admise au blocage', 'mm', { facultatif: true }),
    ],
  },
  GROUPE_MATERIAU,
  GROUPE_SOUDAGE,
  groupeCoefficients(true),
];

function groupesTe(base: string): Groupe[] {
  return [
    {
      titre: 'Pieces',
      champs: [
        nombre('t_p', 't<sub>p</sub>, plat attache', 'mm'),
        nombre('L', 'L, longueur soudee', 'mm'),
        nombre('t_b', `t<sub>b</sub>, ${base}`, 'mm'),
      ],
    },
    {
      titre: 'Soudure',
      champs: [
        {
          cle: 'type_soudure',
          libelle: 'Type',
          unite: '',
          type: 'choix',
          options: [
            ['angle', "cordons d'angle"],
            ['penetration-partielle', 'penetration partielle'],
            ['penetration-totale', 'pleine penetration'],
          ],
        },
        nombre('a', 'a, gorge ou penetration', 'mm', { visible: (v) => v.type_soudure !== 'penetration-totale' }),
        {
          cle: 'cotes',
          libelle: 'Cotes soudes',
          unite: '',
          type: 'choix',
          options: [
            ['2', 'deux cotes'],
            ['1', 'un seul cote'],
          ],
          visible: (v) => v.type_soudure !== 'penetration-totale',
        },
      ],
    },
    {
      titre: 'Sollicitations (au centre du plat)',
      champs: [
        nombre('N', 'N, traction +', 'kN'),
        nombre('V_para', 'V<sub>//</sub>, le long du cordon', 'kN'),
        nombre('V_perp', 'V<sub>&perp;</sub>, a travers le plat', 'kN'),
        nombre('M_plan', 'M dans le plan du plat', 'kN.m'),
        nombre('M_hors', "M autour de l'axe du cordon", 'kN.m'),
      ],
    },
    GROUPE_MATERIAU,
    GROUPE_SOUDAGE,
    groupeCoefficients(false),
  ];
}

const RECOUVREMENT: Groupe[] = [
  {
    titre: 'Plats',
    champs: [
      nombre('b_p', 'b<sub>p</sub>, plat attache', 'mm'),
      nombre('t_p', 't<sub>p</sub>, plat attache', 'mm'),
      nombre('b_b', 'b<sub>b</sub>, plat de base', 'mm'),
      nombre('t_b', 't<sub>b</sub>, plat de base', 'mm'),
      nombre('L_r', 'L<sub>r</sub>, recouvrement', 'mm'),
    ],
  },
  {
    titre: 'Cordons',
    champs: [
      nombre('a', 'a, gorge', 'mm'),
      { cle: 'lateraux', libelle: 'cordons lateraux', unite: '', type: 'case' },
      { cle: 'frontal', libelle: 'cordon frontal', unite: '', type: 'case' },
    ],
  },
  {
    titre: 'Sollicitations (au centre des cordons)',
    champs: [
      nombre('N', 'N, le long du recouvrement', 'kN'),
      nombre('V', 'V, en travers', 'kN'),
      nombre('M', 'M dans le plan', 'kN.m'),
    ],
  },
  GROUPE_MATERIAU,
  groupeCoefficients(false),
];

const PROFILE: Groupe[] = [
  {
    titre: 'Profile',
    champs: [
      nombre('h', 'h, hauteur', 'mm'),
      nombre('b', 'b, largeur', 'mm'),
      nombre('t_w', 't<sub>w</sub>, ame', 'mm'),
      nombre('t_f', 't<sub>f</sub>, semelle', 'mm'),
      nombre('t_platine', 'platine, epaisseur', 'mm'),
    ],
  },
  {
    titre: 'Cordons',
    champs: [nombre('a_f', 'a<sub>f</sub>, semelles', 'mm'), nombre('a_w', 'a<sub>w</sub>, ame', 'mm')],
  },
  {
    titre: 'Sollicitations',
    champs: [
      nombre('N', 'N, traction +', 'kN'),
      nombre('V_z', "V<sub>z</sub>, selon l'ame", 'kN'),
      nombre('V_y', 'V<sub>y</sub>, selon les semelles', 'kN'),
      nombre('M_y', 'M<sub>y</sub>, flexion forte', 'kN.m'),
      nombre('M_z', 'M<sub>z</sub>, flexion faible', 'kN.m'),
    ],
  },
  GROUPE_MATERIAU,
  GROUPE_SOUDAGE,
  groupeCoefficients(false),
];

export const FORMULAIRES: Record<Outil, Groupe[]> = {
  'chaise-ancrage': CHAISE,
  te: groupesTe('platine'),
  cruciforme: groupesTe('plat traversant'),
  angle: groupesTe("piece d'angle"),
  recouvrement: RECOUVREMENT,
  'profile-platine': PROFILE,
};

const COEFFICIENTS: Valeurs = { gamma_M0: '1', gamma_M1: '1', gamma_M2: '1,25', gamma_c: '1,5' };
const MATERIAU: Valeurs = { nuance: 'S235', qualiteZ: 'aucune' };
const SOUDAGE: Valeurs = { forme: 'angle-multipasse', bridage: 'faible', prechauffage: 'non' };

/**
 * Valeurs de depart. Chaque cas est celui de la documentation de validation,
 * de sorte que la page s'ouvre sur un resultat relisible a la main.
 */
export function valeursParDefaut(outil: Outil): Valeurs {
  switch (outil) {
    case 'chaise-ancrage':
      return {
        b: '300', h: '300', t: '30', d_0: '80',
        t_w: '20', h_w: '150', L_w: '300', e: '220',
        a: '10', l_eff: '', contactDirect: 'non',
        D: '150', excentrement: '', inclinaison: '0',
        schema: 'appui-continu', type_appui: 'beton', L: '300', f_ck: '30', k_j: '1', l_appui: '100',
        t_w_lierne: '9', h_w_lierne: '195', t_f_lierne: '12,5', b_f_lierne: '80',
        N_ELU: '1000', P_p: '', F_tk: '', P_blocage: '600', delta_lim: '',
        ...MATERIAU, qualiteZ: 'Z15', ...SOUDAGE, ...COEFFICIENTS,
      };
    case 'te':
    case 'cruciforme':
    case 'angle':
      return {
        t_p: '20', L: '200', t_b: '20', type_soudure: 'angle', a: '6', cotes: '2',
        N: '240', V_para: '0', V_perp: '0', M_plan: '0', M_hors: '0',
        ...MATERIAU, ...SOUDAGE, forme: outil === 'angle' ? 'assemblage-angle' : 'angle-multipasse',
        ...(outil === 'angle' ? { qualiteZ: 'Z15' } : {}),
        ...COEFFICIENTS,
      };
    case 'recouvrement':
      return {
        b_p: '100', t_p: '10', b_b: '120', t_b: '10', L_r: '100', a: '5', lateraux: 'oui', frontal: 'oui',
        N: '100', V: '0', M: '0', ...MATERIAU, ...COEFFICIENTS,
      };
    case 'profile-platine':
      return {
        h: '200', b: '200', t_w: '10', t_f: '15', t_platine: '20', a_f: '7', a_w: '5',
        N: '0', V_z: '100', V_y: '0', M_y: '50', M_z: '0', ...MATERIAU, ...SOUDAGE, ...COEFFICIENTS,
      };
  }
}

/** Le champ est-il affiche, et donc lu ? */
export function estVisible(groupe: Groupe, champ: Champ, v: Valeurs): boolean {
  return (groupe.visible?.(v) ?? true) && (champ.visible?.(v) ?? true);
}

export type Lecture = { ok: true; modele: Modele } | { ok: false; message: string; champ: string };

class Refus extends Error {
  constructor(readonly champ: string, message: string) {
    super(message);
  }
}

/**
 * Modele du noyau lu depuis les champs, ou refus motive nommant le champ.
 *
 * Les champs masques ne sont PAS lus : le diametre d'une lierne n'est pas
 * reclame sur un appui en beton.
 */
export function lireSaisie(outil: Outil, v: Valeurs): Lecture {
  const groupes = FORMULAIRES[outil];
  const lus: Record<string, number | undefined> = {};
  try {
    for (const g of groupes) {
      for (const c of g.champs) {
        if (c.type !== 'nombre' || !estVisible(g, c, v)) continue;
        const n = lireNombre(v[c.cle] ?? '');
        if (n === null) {
          if (c.facultatif && (v[c.cle] ?? '').trim() === '') {
            lus[c.cle] = undefined;
            continue;
          }
          throw new Refus(c.cle, `Saisie invalide : le champ ${c.cle.replace(/_/g, ' ')} doit etre un nombre.`);
        }
        lus[c.cle] = n;
      }
    }
    return { ok: true, modele: construire(outil, v, lus) };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, message: e.message, champ: e.champ };
    throw e;
  }
}

function profil(n: Record<string, number | undefined>): ProfilEC3 {
  return {
    ...ec3Recommande(),
    gamma_M0: n.gamma_M0 ?? 1,
    gamma_M1: n.gamma_M1 ?? 1,
    gamma_M2: n.gamma_M2 ?? 1.25,
    gamma_c: n.gamma_c ?? 1.5,
  };
}

/** Un nombre exige (champ visible et non facultatif) : present par construction. */
function exige(n: Record<string, number | undefined>, cle: string): number {
  const x = n[cle];
  if (x === undefined) throw new Refus(cle, `Saisie invalide : le champ ${cle} est requis.`);
  return x;
}

function construire(outil: Outil, v: Valeurs, n: Record<string, number | undefined>): Modele {
  const oui = (cle: string): boolean => v[cle] === 'oui';
  const materiau = {
    nuance: v.nuance as 'S235',
    qualiteZ: v.qualiteZ as 'aucune',
  };
  const conditionsSoudage = {
    forme: v.forme as 'angle-multipasse',
    bridage: v.bridage as 'faible',
    prechauffage: oui('prechauffage'),
  };

  if (outil === 'chaise-ancrage') {
    const typeAppui = v.type_appui === 'lierne-acier' ? 'lierne-acier' : 'beton';
    const schema = v.schema === 'appui-extremites' ? 'appui-extremites' : 'appui-continu';
    return {
      detail: 'chaise-ancrage',
      donnees: {
        assemblage: {
          platine: { b: exige(n, 'b'), h: exige(n, 'h'), t: exige(n, 't'), d_0: exige(n, 'd_0') },
          plats: {
            t_w: exige(n, 't_w'),
            h_w: exige(n, 'h_w'),
            L_w: exige(n, 'L_w'),
            e: exige(n, 'e'),
            ...(schema === 'appui-extremites' ? { L: exige(n, 'L') } : {}),
          },
          soudure: {
            a: exige(n, 'a'),
            ...(n.l_eff === undefined ? {} : { l_eff: n.l_eff }),
            contactDirect: oui('contactDirect'),
          },
          ancrage: {
            D: exige(n, 'D'),
            ...(n.excentrement === undefined ? {} : { excentrement: n.excentrement }),
            inclinaison: exige(n, 'inclinaison'),
          },
          appui:
            typeAppui === 'beton'
              ? {
                  type: 'beton',
                  f_ck: exige(n, 'f_ck'),
                  k_j: exige(n, 'k_j'),
                  ...(schema === 'appui-extremites' ? { l_appui: exige(n, 'l_appui') } : {}),
                }
              : {
                  type: 'lierne-acier',
                  t_w_lierne: exige(n, 't_w_lierne'),
                  h_w_lierne: exige(n, 'h_w_lierne'),
                  t_f_lierne: exige(n, 't_f_lierne'),
                  b_f_lierne: exige(n, 'b_f_lierne'),
                },
          schema,
        },
        materiau,
        actions: {
          N_ELU: exige(n, 'N_ELU'),
          ...(n.P_p === undefined ? {} : { P_p: n.P_p }),
          ...(n.F_tk === undefined ? {} : { F_tk: n.F_tk }),
          ...(n.P_blocage === undefined ? {} : { P_blocage: n.P_blocage }),
        },
        profil: profil(n),
        conditionsSoudage,
        ...(n.delta_lim === undefined ? {} : { delta_lim: n.delta_lim }),
      },
    };
  }

  if (outil === 'te' || outil === 'cruciforme' || outil === 'angle') {
    const type = v.type_soudure as 'angle' | 'penetration-partielle' | 'penetration-totale';
    return {
      detail: 'te',
      donnees: {
        nature: outil,
        t_p: exige(n, 't_p'),
        L: exige(n, 'L'),
        t_b: exige(n, 't_b'),
        soudure: {
          type,
          // Pleine penetration : la « gorge » est l'epaisseur du plat, qui ne
          // sert qu'a l'arrachement lamellaire.
          a: type === 'penetration-totale' ? exige(n, 't_p') : exige(n, 'a'),
          cotes: type === 'penetration-totale' ? 2 : v.cotes === '1' ? 1 : 2,
        },
        sollicitations: {
          N: exige(n, 'N'),
          V_para: exige(n, 'V_para'),
          V_perp: exige(n, 'V_perp'),
          M_plan: exige(n, 'M_plan'),
          M_hors: exige(n, 'M_hors'),
        },
        materiau,
        profil: profil(n),
        conditionsSoudage,
      },
    };
  }

  if (outil === 'recouvrement') {
    return {
      detail: 'recouvrement',
      donnees: {
        b_p: exige(n, 'b_p'),
        t_p: exige(n, 't_p'),
        b_b: exige(n, 'b_b'),
        t_b: exige(n, 't_b'),
        L_r: exige(n, 'L_r'),
        cordons: { lateraux: oui('lateraux'), frontal: oui('frontal') },
        a: exige(n, 'a'),
        sollicitations: { N: exige(n, 'N'), V: exige(n, 'V'), M: exige(n, 'M') },
        materiau,
        profil: profil(n),
      },
    };
  }

  return {
    detail: 'profile-platine',
    donnees: {
      h: exige(n, 'h'),
      b: exige(n, 'b'),
      t_w: exige(n, 't_w'),
      t_f: exige(n, 't_f'),
      a_f: exige(n, 'a_f'),
      a_w: exige(n, 'a_w'),
      t_platine: exige(n, 't_platine'),
      sollicitations: {
        N: exige(n, 'N'),
        V_y: exige(n, 'V_y'),
        V_z: exige(n, 'V_z'),
        M_y: exige(n, 'M_y'),
        M_z: exige(n, 'M_z'),
      },
      materiau,
      profil: profil(n),
      conditionsSoudage,
    },
  };
}

const texte = (x: number | undefined): string => (x === undefined ? '' : String(x).replace('.', ','));
const ouiNon = (b: boolean): string => (b ? 'oui' : 'non');

/**
 * Champs d'un modele relu depuis un fichier : l'outil et ses valeurs.
 * Les champs sans objet gardent leur valeur par defaut.
 */
export function valeursDepuisModele(m: Modele): { outil: Outil; valeurs: Valeurs } {
  const communs = (d: { materiau: { nuance: string; qualiteZ: string }; profil?: ProfilEC3 }): Valeurs => ({
    nuance: d.materiau.nuance,
    qualiteZ: d.materiau.qualiteZ,
    ...(d.profil === undefined
      ? {}
      : {
          gamma_M0: texte(d.profil.gamma_M0),
          gamma_M1: texte(d.profil.gamma_M1),
          gamma_M2: texte(d.profil.gamma_M2),
          gamma_c: texte(d.profil.gamma_c),
        }),
  });
  const soudage = (c: { forme: string; bridage: string; prechauffage: boolean } | undefined): Valeurs =>
    c === undefined ? {} : { forme: c.forme, bridage: c.bridage, prechauffage: ouiNon(c.prechauffage) };

  switch (m.detail) {
    case 'chaise-ancrage': {
      const d = m.donnees;
      const { platine, plats, soudure, ancrage, appui, schema } = d.assemblage;
      return {
        outil: 'chaise-ancrage',
        valeurs: {
          ...valeursParDefaut('chaise-ancrage'),
          b: texte(platine.b), h: texte(platine.h), t: texte(platine.t), d_0: texte(platine.d_0),
          t_w: texte(plats.t_w), h_w: texte(plats.h_w), L_w: texte(plats.L_w), e: texte(plats.e),
          ...(plats.L === undefined ? {} : { L: texte(plats.L) }),
          a: texte(soudure.a), l_eff: texte(soudure.l_eff), contactDirect: ouiNon(soudure.contactDirect),
          D: texte(ancrage.D), excentrement: texte(ancrage.excentrement), inclinaison: texte(ancrage.inclinaison),
          schema, type_appui: appui.type,
          ...(appui.f_ck === undefined ? {} : { f_ck: texte(appui.f_ck) }),
          ...(appui.k_j === undefined ? {} : { k_j: texte(appui.k_j) }),
          ...(appui.l_appui === undefined ? {} : { l_appui: texte(appui.l_appui) }),
          ...(appui.t_w_lierne === undefined ? {} : { t_w_lierne: texte(appui.t_w_lierne) }),
          ...(appui.h_w_lierne === undefined ? {} : { h_w_lierne: texte(appui.h_w_lierne) }),
          ...(appui.t_f_lierne === undefined ? {} : { t_f_lierne: texte(appui.t_f_lierne) }),
          ...(appui.b_f_lierne === undefined ? {} : { b_f_lierne: texte(appui.b_f_lierne) }),
          N_ELU: texte(d.actions.N_ELU), P_p: texte(d.actions.P_p), F_tk: texte(d.actions.F_tk),
          P_blocage: texte(d.actions.P_blocage), delta_lim: texte(d.delta_lim),
          ...communs(d),
          ...soudage(d.conditionsSoudage),
        },
      };
    }
    case 'te': {
      const d = m.donnees;
      return {
        outil: d.nature,
        valeurs: {
          ...valeursParDefaut(d.nature),
          t_p: texte(d.t_p), L: texte(d.L), t_b: texte(d.t_b),
          type_soudure: d.soudure.type, a: texte(d.soudure.a), cotes: String(d.soudure.cotes),
          N: texte(d.sollicitations.N), V_para: texte(d.sollicitations.V_para),
          V_perp: texte(d.sollicitations.V_perp), M_plan: texte(d.sollicitations.M_plan),
          M_hors: texte(d.sollicitations.M_hors),
          ...communs(d),
          ...soudage(d.conditionsSoudage),
        },
      };
    }
    case 'recouvrement': {
      const d = m.donnees;
      return {
        outil: 'recouvrement',
        valeurs: {
          ...valeursParDefaut('recouvrement'),
          b_p: texte(d.b_p), t_p: texte(d.t_p), b_b: texte(d.b_b), t_b: texte(d.t_b), L_r: texte(d.L_r),
          a: texte(d.a), lateraux: ouiNon(d.cordons.lateraux), frontal: ouiNon(d.cordons.frontal),
          N: texte(d.sollicitations.N), V: texte(d.sollicitations.V), M: texte(d.sollicitations.M),
          ...communs(d),
        },
      };
    }
    case 'profile-platine': {
      const d = m.donnees;
      return {
        outil: 'profile-platine',
        valeurs: {
          ...valeursParDefaut('profile-platine'),
          h: texte(d.h), b: texte(d.b), t_w: texte(d.t_w), t_f: texte(d.t_f), t_platine: texte(d.t_platine),
          a_f: texte(d.a_f), a_w: texte(d.a_w),
          N: texte(d.sollicitations.N), V_z: texte(d.sollicitations.V_z), V_y: texte(d.sollicitations.V_y),
          M_y: texte(d.sollicitations.M_y), M_z: texte(d.sollicitations.M_z),
          ...communs(d),
          ...soudage(d.conditionsSoudage),
        },
      };
    }
  }
}
