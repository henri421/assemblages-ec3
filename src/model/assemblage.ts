/**
 * Geometrie d une tete d ancrage de tirant : platine percee soudee sur deux
 * plats paralleles (double te ouvert).
 *
 * Unites : longueurs en mm, resistances en MPa, angles en degres.
 *
 * Empilement, du tirant vers le support :
 *
 *        ||  [bloc]  ||        ames : raidisseurs soudes sur la face libre
 *      ==++==+====+==++==      platine, percee, posee sur le support
 *      ##################      support (beton, ou lierne en appui aux extremites)
 *
 * La platine porte sur le support. Les deux ames sont soudees sur sa face
 * libre, de part et d autre du tirant ; le bloc d ancrage et le verin de mise
 * en tension prennent place ENTRE elles, la couronne appuyant sur la platine.
 * Les ames ne touchent pas le support : elles raidissent la platine.
 */

/**
 * Schema statique des ames.
 *
 * - `appui-continu` : la platine porte sur toute sa surface (beton de paroi
 *   moulee, massif). Les ames forment avec elle des poutres en te qui
 *   repartissent la charge de la couronne sur la longueur L_w.
 * - `appui-extremites` : la platine ne porte qu a ses extremites
 *   (franchissement entre deux profiles de berlinoise, entre les deux U d une
 *   lierne). Platine et ames deviennent une poutre de portee `L`, dans le sens
 *   des ames : la platine en est la semelle TENDUE, le chant libre des ames la
 *   fibre COMPRIMEE.
 */
export type SchemaAppui = 'appui-continu' | 'appui-extremites';

export interface Platine {
  /** Largeur de la platine, direction perpendiculaire aux ames (mm). */
  b: number;
  /** Hauteur de la platine, direction parallele aux ames (mm). */
  h: number;
  /** Epaisseur (mm). */
  t: number;
  /** Diametre du percage de passage (mm). */
  d_0: number;
}

export interface Plats {
  /** Epaisseur d une ame (mm). */
  t_w: number;
  /** Hauteur d une ame, perpendiculaire a la platine (mm). */
  h_w: number;
  /** Longueur d une ame, dans le plan de la platine (mm). */
  L_w: number;
  /** Entraxe des deux ames (mm). */
  e: number;
  /** Portee entre appuis, dans le sens des ames, requise si schema = 'appui-extremites' (mm). */
  L?: number;
}

export interface Soudure {
  /** Gorge du cordon d angle (mm). */
  a: number;
  /** Longueur efficace du cordon (mm) ; L_w par defaut. */
  l_eff?: number;
  /**
   * Contact plan sur plan prescrit ET controle.
   * Si true, la compression transite par contact direct et n entre pas dans la
   * section de gorge. Hypothese a ne poser qu avec ajustage controle et EXC3.
   */
  contactDirect: boolean;
}

export interface Ancrage {
  /** Diametre de la couronne d appui du bloc d ancrage (mm). */
  D: number;
  /** Excentrement de l axe du tirant / plan median des ames (mm). */
  excentrement?: number;
  /** Ecart de l axe du tirant a la normale a la platine (degres). */
  inclinaison: number;
}

export interface Appui {
  type: 'beton' | 'lierne-acier';
  /** Si beton : resistance caracteristique (MPa). */
  f_ck?: number;
  /** Si beton : coefficient de concentration k_j, 1 <= k_j <= 3 ; 1 par defaut. */
  k_j?: number;
  /**
   * Si appui-extremites : longueur d appui de chaque extremite, dans le sens
   * de la portee (mm). Sur lierne, la largeur de la semelle chargee b_f_lierne
   * en tient lieu si elle est absente.
   */
  l_appui?: number;
  /** Si lierne : epaisseur d ame du profil support (mm). */
  t_w_lierne?: number;
  /** Si lierne : hauteur d ame entre semelles du profil support (mm). */
  h_w_lierne?: number;
  /** Si lierne : epaisseur de la semelle chargee du profil support (mm). */
  t_f_lierne?: number;
  /** Si lierne : largeur de la semelle chargee du profil support (mm). */
  b_f_lierne?: number;
}

export interface Assemblage {
  platine: Platine;
  plats: Plats;
  soudure: Soudure;
  ancrage: Ancrage;
  appui: Appui;
  schema: SchemaAppui;
}
