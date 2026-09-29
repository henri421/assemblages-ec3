import type { Assemblage } from '../../src/model/assemblage';

/**
 * Chaise de reference « VASSE-1 » (docs/validation/vasse.md) : platine posee
 * sur beton (appui continu), deux ames raidisseuses sur sa face libre, S235,
 * N_Ed = 1000 kN.
 *
 * Platine 300 x 300 x 30, percage 80 ; ames 20 x 150 x 300 a 220 d entraxe ;
 * cordons de gorge 10 ; couronne D = 150 ; beton C30/37.
 *
 * Section en te d une ame (eps = 1) :
 *   b_eff,max = min(220/4 ; 15*30) = 55 ; b_int = 55 ; b_ext = min(55 ; 40 - 10) = 30
 *   B_f = 105 ; A = 3150 + 3000 = 6150 mm2 ; z_G = 362250 / 6150 = 58,902439 mm
 *   I = 18 307 591,46 mm4 ; S_f = 3150 * 43,902439 = 138 292,68 mm3
 *
 * Soudures, valeurs calculees a la main :
 *   l_charge = min(300 ; 150 + 2*30) = 210 mm
 *   F_Ed     = 0,5 * 1000 / 210 = 2,380952 kN/mm par ame (suspension)
 *   M_enc    = 1000 * 220 / 8 = 27,5 kN.m ; m_enc = 27500 / 210 = 130,952 kN
 *   m_pl,p   = 30^2 * 235 / 4 = 52,875 kN ; m_pl,w = 20^2 * 235 / 4 = 23,5 kN
 *   m_Ed     = 23,5 kN (borne : ame) ; delta_F = 23,5 / (20 + 10) = 0,783333 kN/mm
 *   V_te     = 500 * (300 - 210) / 600 = 75 kN ; v = 75 * S_f / I = 0,566538 kN/mm
 *   interieur : p_1 = 1,190476 + 0,783333 = 1,973810 ; p_para = 0,283269 kN/mm
 *   exterieur : p_1 = 1,190476 - 0,783333 = 0,407143 kN/mm
 *   interieur : sigma_perp = tau_perp = 139,5694 MPa, tau_para = 28,3269 MPa,
 *               equivalente 283,4179 MPa, taux 0,787272 ; taux 2 = 0,538462
 */
export function chaiseDeReference(): Assemblage {
  return {
    platine: { b: 300, h: 300, t: 30, d_0: 80 },
    plats: { t_w: 20, h_w: 150, L_w: 300, e: 220 },
    soudure: { a: 10, contactDirect: false },
    ancrage: { D: 150, inclinaison: 0 },
    appui: { type: 'beton', f_ck: 30 },
    schema: 'appui-continu',
  };
}

/** Section en te de la chaise de reference, hors percage. */
export const AME_DE_REFERENCE = { S_f: 138292.6829268293, I: 18307591.46341463 };

/**
 * Variante « VASSE-2 » : la meme chaise franchit l espace entre les deux U
 * d une lierne (UPN 220, S235), portee L = 300 mm dans le sens des ames.
 */
export function chaiseSurLierne(): Assemblage {
  const a = chaiseDeReference();
  a.schema = 'appui-extremites';
  a.plats.L = 300;
  a.appui = { type: 'lierne-acier', t_w_lierne: 9, h_w_lierne: 195, t_f_lierne: 12.5, b_f_lierne: 80 };
  return a;
}
