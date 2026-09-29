import type { Assemblage } from '../../src/model/assemblage';

/**
 * Chaise de reference « VASSE-1 » (docs/validation/vasse.md), appui continu
 * sur beton, S235, N_Ed = 1000 kN.
 *
 * Platine 300 x 300 x 30, percage 80 ; ames 20 x 150 x 300 a 220 d entraxe ;
 * cordons de gorge 10 ; couronne D = 150 ; beton C30/37.
 *
 * Valeurs attendues, calculees a la main :
 *   l_charge = min(300 ; 150 + 2*30) = 210 mm
 *   F_Ed     = 0,5 * 1000 / 210 = 2,380952 kN/mm par ame
 *   M_enc    = 1000 * 220 / 8 = 27,5 kN.m ; m_enc = 27500 / 210 = 130,952 kN
 *   m_pl,p   = 30^2 * 235 / 4 = 52,875 kN ; m_pl,w = 20^2 * 235 / 4 = 23,5 kN
 *   m_Ed     = 23,5 kN (borne : ame) ; delta_F = 23,5 / (20 + 10) = 0,783333 kN/mm
 *   p_1 ext  = -1,190476 + 0,783333 = -0,407143 kN/mm
 *   p_1 int  = -1,190476 - 0,783333 = -1,973810 kN/mm
 *   cordon interieur : sigma_perp = tau_perp = -139,5694 MPa, equivalente
 *   279,1388 MPa, taux 279,1388 / 360 = 0,775386
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
