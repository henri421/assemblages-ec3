/**
 * Geometrie d une tete d ancrage de tirant : platine percee soudee sur deux
 * plats paralleles (double te ouvert).
 *
 * Unites : longueurs en mm, resistances en MPa, angles en degres.
 *
 * Ordre des pieces, du bloc d ancrage vers le support :
 *   bloc d ancrage -> platine -> deux ames -> support (beton ou lierne).
 * La couronne du bloc appuie sur la platine entre les ames ; la platine porte
 * sur le chant superieur des ames, dont le chant inferieur porte sur le support.
 */

/**
 * Schema statique des ames.
 *
 * - `appui-continu` : les ames portent sur toute leur longueur (beton de paroi
 *   moulee, semelle de profile, massif). Compression repartie, piece courte.
 * - `appui-extremites` : les ames ne portent qu a leurs extremites
 *   (franchissement entre deux profiles de berlinoise, entre les deux U d une
 *   lierne). L ensemble devient une poutre de portee `L`.
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
  /** Portee entre appuis, requise si schema = 'appui-extremites' (mm). */
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
  /** Si beton : coefficient de concentration k_j <= 3 ; 1 par defaut. */
  k_j?: number;
  /**
   * Si beton : epaisseur d une semelle soudee sous le chant des ames (mm) ;
   * 0 ou absente si le chant porte directement sur le beton.
   */
  t_semelle?: number;
  /** Si appui-extremites sur beton : longueur d appui de chaque extremite d ame (mm). */
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
