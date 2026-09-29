/**
 * Catalogue declaratif des dispositions constructives.
 *
 * Unites : longueurs en mm, angles en degres.
 *
 * Une regle separe son APPLICABILITE de sa SATISFACTION : une regle qui ne
 * regit pas le cas est declaree non applicable, avec son motif, et jamais
 * « satisfaite ». Les dispositions ne modifient pas le verdict de resistance :
 * une piece peut resister et rester irreguliere. C est une information, pas
 * une contradiction.
 */

import type { Assemblage } from '../model/assemblage';
import type { Materiau, QualiteZ } from '../model/materiau';
import { epsilon, limiteElastique } from '../norms/acier';

export type Severite = 'bloquante' | 'avertissement' | 'information';

export interface Regle<C> {
  id: string;
  clause: string;
  severite: Severite;
  /** Enonce court, pour le tableau. */
  enonce: string;
  /** null si la regle s applique ; motif en clair sinon. */
  applicabilite(ctx: C): string | null;
  /**
   * null si satisfaite ; motif de la violation sinon. Pour une regle
   * d information, le texte de l information.
   */
  evaluer(ctx: C): string | null;
}

/** Transpose une regle d un contexte a un autre. */
export function adapter<A, B>(regle: Regle<A>, vers: (ctx: B) => A): Regle<B> {
  return {
    id: regle.id,
    clause: regle.clause,
    severite: regle.severite,
    enonce: regle.enonce,
    applicabilite: (ctx) => regle.applicabilite(vers(ctx)),
    evaluer: (ctx) => regle.evaluer(vers(ctx)),
  };
}

// ---------------------------------------------------------------------------
// Regles communes a tout cordon d angle
// ---------------------------------------------------------------------------

export interface CordonDecrit {
  id: string;
  /** Gorge (mm). */
  a: number;
  /** Longueur efficace (mm). */
  l: number;
  /** Epaisseur de la plus mince des pieces qu il assemble (mm). */
  t_min: number;
  /** Type ; les regles de gorge ne visent que les cordons d angle. */
  type: 'angle' | 'penetration-partielle';
}

export interface ContexteCordons {
  cordons: CordonDecrit[];
  /** Epaisseurs de toutes les pieces soudees (mm). */
  epaisseurs: number[];
}

const nb = (x: number): string => String(Number(x.toFixed(1)));

function angles(ctx: ContexteCordons): CordonDecrit[] {
  return ctx.cordons.filter((c) => c.type === 'angle');
}

const SANS_CORDON_D_ANGLE = 'aucun cordon d angle';

export const GORGE_MIN: Regle<ContexteCordons> = {
  id: 'gorge-min',
  clause: 'EN 1993-1-8 §4.5.2(2)',
  severite: 'bloquante',
  enonce: 'gorge a >= 3 mm',
  applicabilite: (ctx) => (angles(ctx).length === 0 ? SANS_CORDON_D_ANGLE : null),
  evaluer: (ctx) => {
    const fautifs = angles(ctx).filter((c) => c.a < 3);
    return fautifs.length === 0
      ? null
      : fautifs.map((c) => `cordon ${c.id} : a = ${nb(c.a)} mm < 3 mm`).join(' ; ');
  },
};

export const LONGUEUR_EFFICACE_MIN: Regle<ContexteCordons> = {
  id: 'longueur-efficace-min',
  clause: 'EN 1993-1-8 §4.5.1(2)',
  severite: 'bloquante',
  enonce: 'l_eff >= max(30 mm ; 6a) pour un cordon porteur',
  applicabilite: (ctx) => (angles(ctx).length === 0 ? SANS_CORDON_D_ANGLE : null),
  evaluer: (ctx) => {
    const fautifs = angles(ctx).filter((c) => c.l < Math.max(30, 6 * c.a));
    return fautifs.length === 0
      ? null
      : fautifs
          .map((c) => `cordon ${c.id} : l = ${nb(c.l)} mm < max(30 ; 6a = ${nb(6 * c.a)}) mm`)
          .join(' ; ');
  },
};

export const RETOURS_EXTREMITE: Regle<ContexteCordons> = {
  id: 'retours-extremite',
  clause: 'EN 1993-1-8 §4.3.2.1(4)',
  severite: 'information',
  enonce: 'retours d extremite sur au moins deux fois le cote',
  applicabilite: (ctx) => (angles(ctx).length === 0 ? SANS_CORDON_D_ANGLE : null),
  evaluer: (ctx) => {
    const cote = Math.max(...angles(ctx).map((c) => c.a * Math.SQRT2));
    return (
      'les cordons qui s arretent en bout de piece se retournent sans interruption, a pleine ' +
      `section, sur au moins deux fois leur cote, soit ${nb(2 * cote)} mm, sauf impossibilite d acces`
    );
  },
};

export const EPAISSEUR_MIN: Regle<ContexteCordons> = {
  id: 'epaisseur-min',
  clause: 'EN 1993-1-8 §4.1(1)',
  severite: 'bloquante',
  enonce: 'pieces soudees d au moins 4 mm (domaine d application)',
  applicabilite: () => null,
  evaluer: (ctx) => {
    const minces = ctx.epaisseurs.filter((t) => t < 4);
    return minces.length === 0
      ? null
      : `piece de ${nb(Math.min(...minces))} mm : hors du domaine de l EN 1993-1-8 (t >= 4 mm), relever de l EN 1993-1-3`;
  },
};

export const GORGE_VS_PENETRATION: Regle<ContexteCordons> = {
  id: 'gorge-vs-penetration',
  clause: 'EN 1993-1-8 §4.5',
  severite: 'information',
  enonce: 'a > 0,7 t : une penetration devient plus economique',
  applicabilite: (ctx) => (angles(ctx).length === 0 ? SANS_CORDON_D_ANGLE : null),
  evaluer: (ctx) => {
    const epais = angles(ctx).filter((c) => c.a > 0.7 * c.t_min);
    return epais.length === 0
      ? null
      : epais
          .map(
            (c) =>
              `cordon ${c.id} : a = ${nb(c.a)} mm > 0,7 t = ${nb(0.7 * c.t_min)} mm — une soudure a ` +
              'penetration partielle ou totale serait plus economique et supprimerait la discontinuite de racine',
          )
          .join(' ; ');
  },
};

/** Regles communes a tout assemblage soude par cordons d angle. */
export const REGLES_CORDONS: readonly Regle<ContexteCordons>[] = [
  GORGE_MIN,
  LONGUEUR_EFFICACE_MIN,
  RETOURS_EXTREMITE,
  EPAISSEUR_MIN,
  GORGE_VS_PENETRATION,
];

// ---------------------------------------------------------------------------
// Tete d ancrage
// ---------------------------------------------------------------------------

export interface ContexteChaise {
  assemblage: Assemblage;
  materiau: Materiau;
}

/** Les cordons d une chaise vus par les regles communes. */
export function cordonsDeLaChaise(ctx: ContexteChaise): ContexteCordons {
  const { platine, plats, soudure } = ctx.assemblage;
  const l = soudure.l_eff ?? plats.L_w;
  const t_min = Math.min(platine.t, plats.t_w);
  return {
    cordons: [{ id: 'ame-platine', a: soudure.a, l, t_min, type: 'angle' }],
    epaisseurs: [platine.t, plats.t_w],
  };
}

const RANG_Z: Record<QualiteZ, number> = { aucune: 0, Z15: 1, Z25: 2, Z35: 3 };

export const REGLES_CHAISE: readonly Regle<ContexteChaise>[] = [
  ...REGLES_CORDONS.map((r) => adapter(r, cordonsDeLaChaise)),
  {
    id: 'longueur-cordon',
    clause: 'geometrie',
    severite: 'bloquante',
    enonce: 'l_eff <= L_w',
    applicabilite: (ctx) => (ctx.assemblage.soudure.l_eff === undefined ? 'l_eff pris egal a L_w' : null),
    evaluer: ({ assemblage: { soudure, plats } }) =>
      (soudure.l_eff ?? plats.L_w) <= plats.L_w
        ? null
        : `l_eff = ${nb(soudure.l_eff ?? 0)} mm depasse la longueur des ames L_w = ${nb(plats.L_w)} mm`,
  },
  {
    id: 'entraxe-outillage',
    clause: 'CFMS TA 2020',
    severite: 'bloquante',
    enonce: 'e >= D + 60 mm (passage du verin entre les ames)',
    applicabilite: () => null,
    evaluer: ({ assemblage: { plats, ancrage } }) =>
      plats.e >= ancrage.D + 60
        ? null
        : `e = ${nb(plats.e)} mm < D + 60 = ${nb(ancrage.D + 60)} mm : le verin ne passe pas entre les ames`,
  },
  {
    id: 'pince-percage',
    clause: 'geometrie',
    severite: 'bloquante',
    enonce: 'percage a au moins 20 mm des bords : d_0 < b - 40 et d_0 < h - 40',
    applicabilite: () => null,
    evaluer: ({ assemblage: { platine } }) => {
      const limite = Math.min(platine.b, platine.h) - 40;
      return platine.d_0 < limite
        ? null
        : `d_0 = ${nb(platine.d_0)} mm >= ${nb(limite)} mm : pince de moins de 20 mm au bord de la platine`;
    },
  },
  {
    id: 'couronne-sur-percage',
    clause: 'geometrie',
    severite: 'bloquante',
    enonce: 'D > d_0 : la couronne porte autour du percage',
    applicabilite: () => null,
    evaluer: ({ assemblage: { platine, ancrage } }) =>
      ancrage.D > platine.d_0
        ? null
        : `D = ${nb(ancrage.D)} mm <= d_0 = ${nb(platine.d_0)} mm : la couronne tombe dans le percage`,
  },
  {
    id: 'inclinaison',
    clause: 'EN 1537',
    severite: 'bloquante',
    enonce: 'inclinaison <= 3 degres, sinon cale biaise ou tete articulee',
    applicabilite: () => null,
    evaluer: ({ assemblage: { ancrage } }) =>
      ancrage.inclinaison <= 3
        ? null
        : `inclinaison ${nb(ancrage.inclinaison)} degres > 3 : une plaque biaise ou une tete articulee est requise`,
  },
  {
    id: 'qualite-z',
    clause: 'EN 10164',
    severite: 'avertissement',
    enonce: 't > 25 mm et a > 0,5 t_w : qualite Z25 au moins',
    applicabilite: ({ assemblage: { platine, plats, soudure } }) =>
      platine.t > 25 && soudure.a > 0.5 * plats.t_w
        ? null
        : 'platine de 25 mm au plus, ou gorge moderee au regard des ames',
    evaluer: ({ materiau }) =>
      RANG_Z[materiau.qualiteZ] >= RANG_Z.Z25
        ? null
        : `qualite ${materiau.qualiteZ} : une qualite Z25 selon l EN 10164 est requise pour la platine`,
  },
  {
    id: 'exc3',
    clause: 'EN 1090-2',
    severite: 'information',
    enonce: 'classe d execution EXC3, element non redondant',
    applicabilite: () => null,
    evaluer: () =>
      'la tete d ancrage est un element non redondant : sa ruine libere le tirant. Classe d execution EXC3',
  },
  {
    id: 'contact-direct',
    clause: 'EN 1090-2',
    severite: 'avertissement',
    enonce: 'contact direct : ajustage prescrit et controle',
    applicabilite: ({ assemblage: { soudure } }) =>
      soudure.contactDirect ? null : 'aucune compression n est confiee au contact',
    evaluer: () =>
      'la compression est confiee au contact entre platine et ames : l ajustage plan sur plan doit ' +
      'etre prescrit aux plans et controle, faute de quoi la gorge la reprend',
  },
  {
    id: 'classe-ame',
    clause: 'EN 1993-1-1 §5.5, tableau 5.2',
    severite: 'bloquante',
    enonce: 'ame au plus de classe 3 : h_w / t_w <= 14 eps',
    applicabilite: () => null,
    evaluer: ({ assemblage: { plats }, materiau }) => {
      const limite = 14 * epsilon(limiteElastique(materiau.nuance, plats.t_w));
      const elancement = plats.h_w / plats.t_w;
      return elancement <= limite
        ? null
        : `h_w / t_w = ${nb(elancement)} > 14 eps = ${nb(limite)} : ame de classe 4`;
    },
  },
];
