/**
 * Verifications de la platine d une tete d ancrage.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa, moments en kN.m.
 *
 * - Appui continu (beton) : troncon en te comprime (§6.2.5), dont la largeur c
 *   integre la flexion de la platine, et poinconnement autour de la couronne.
 * - Appui aux extremites : flexion transversale entre les ames, section nette
 *   au droit du percage, cisaillement au droit des ames, poinconnement ; et,
 *   sur beton, l appui de chaque extremite par troncon en te.
 */

import type { Assemblage } from '../model/assemblage';
import type { ProfilEC3 } from '../norms/ec3-recommande';
import {
  cisaillementAuDroitDesAmes,
  flexionEntreAmes,
  type CisaillementPlatine,
  type FlexionPlatine,
} from './flexion';
import { verifierPoinconnementPlatine, type ResultatPoinconnementPlatine } from './poinconnement';
import { verifierSectionNette, type ResultatSectionNette } from './section-nette';
import { verifierTronconEnT, type ResultatTronconEnT } from './troncon-en-t';

export interface ResultatPlatine {
  /** Appui sur beton, null sur lierne. */
  troncon: ResultatTronconEnT | null;
  /** Appui aux extremites seulement ; null en appui continu. */
  flexion: FlexionPlatine | null;
  sectionNette: ResultatSectionNette | null;
  cisaillement: CisaillementPlatine | null;
  poinconnement: ResultatPoinconnementPlatine;
}

/**
 * Verifications de la platine selon le schema d appui.
 *
 * En appui continu, la platine n a PAS de verification de flexion entre les
 * ames : elle est portee par le beton, et le troncon en te borne deja sa
 * flexion — c est la definition meme de c. La soumettre en plus a N e / 4
 * comme si elle franchissait l entraxe dans le vide la condamnerait sans
 * raison : sur la piece de reference, trois fois sa resistance.
 *
 * L appui continu sur lierne n est pas couvert : une platine posee a plat sur
 * une semelle d acier releve d un autre modele (appui localise sur l ame du
 * profil, EN 1993-1-5 §6), que ce module n implemente qu aux extremites.
 */
export function verifierPlatine(
  assemblage: Assemblage,
  N_Ed: number,
  part: number,
  f_y_platine: number,
  profil: ProfilEC3,
): ResultatPlatine {
  const { platine, plats, ancrage, appui, schema } = assemblage;
  if (schema === 'appui-continu' && appui.type !== 'beton') {
    throw new Error(
      "L appui continu n est couvert que sur beton : sur lierne, choisir l appui aux extremites.",
    );
  }

  const troncon = appui.type === 'beton' ? verifierTronconEnT(assemblage, N_Ed, f_y_platine, profil) : null;
  const poinconnement = verifierPoinconnementPlatine(
    N_Ed,
    ancrage.D,
    platine.t,
    f_y_platine,
    profil.gamma_M0,
  );

  if (schema === 'appui-continu') {
    return { troncon, flexion: null, sectionNette: null, cisaillement: null, poinconnement };
  }

  const flexion = flexionEntreAmes(N_Ed, plats.e, platine.h, plats.L_w);
  const sectionNette = verifierSectionNette(flexion, platine.d_0, platine.t, f_y_platine, profil.gamma_M0);
  const cisaillement = cisaillementAuDroitDesAmes(
    N_Ed,
    part,
    flexion.w,
    platine.t,
    f_y_platine,
    profil.gamma_M0,
  );
  return { troncon, flexion, sectionNette, cisaillement, poinconnement };
}
