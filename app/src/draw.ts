/**
 * Dessins a l'echelle, en SVG. Module PUR : il rend des chaines.
 *
 * Toutes les longueurs sont en millimetres du modele ; le `viewBox` fait
 * l'echelle. Aucun texte n'est place dans les dessins : a l'echelle du
 * modele, une police n'aurait pas de taille lisible. Les legendes vivent
 * dans la page.
 *
 * ⚠ Toute classe emise ici doit avoir sa regle dans `STYLES_TRACE`
 * (export.ts), faute de quoi les dessins exportes sortent en aplat noir. Un
 * test le verifie.
 */

import type { Calcul } from './calcul';

/** Classes de dessin emises par ce module. */
export const CLASSES_DE_DESSIN = [
  'dessin',
  'acier',
  'acier-coupe',
  'beton',
  'soudure',
  'cordon',
  'percage',
  'couronne',
  'bloc',
  'diffusion',
  'contour-c',
  'axe',
  'appui',
  'charge',
] as const;

type Classe = (typeof CLASSES_DE_DESSIN)[number];

/** Coordonnee courte, pour un SVG lisible. */
function co(v: number): string {
  return String(Number(v.toFixed(2)));
}

interface Boite {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function rect(classe: Classe, x0: number, y0: number, x1: number, y1: number, extra = ''): string {
  return (
    `<rect class="${classe}" x="${co(Math.min(x0, x1))}" y="${co(Math.min(y0, y1))}" ` +
    `width="${co(Math.abs(x1 - x0))}" height="${co(Math.abs(y1 - y0))}"${extra} />`
  );
}

function cercle(classe: Classe, cx: number, cy: number, r: number, extra = ''): string {
  return `<circle class="${classe}" cx="${co(cx)}" cy="${co(cy)}" r="${co(r)}"${extra} />`;
}

function ligne(classe: Classe, x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="${classe}" x1="${co(x1)}" y1="${co(y1)}" x2="${co(x2)}" y2="${co(y2)}" />`;
}

function poly(classe: Classe, points: Array<[number, number]>): string {
  return `<polygon class="${classe}" points="${points.map(([x, y]) => `${co(x)},${co(y)}`).join(' ')}" />`;
}

/** Fleche de charge de (x, y1) vers (x, y2), pointe en y2. */
function fleche(x: number, y1: number, y2: number, taille: number): string {
  const s = Math.sign(y2 - y1) || 1;
  return (
    ligne('charge', x, y1, x, y2 - s * taille) +
    poly('charge', [
      [x, y2],
      [x - taille / 2, y2 - s * taille],
      [x + taille / 2, y2 - s * taille],
    ])
  );
}

function svg(boite: Boite, contenu: string[], label: string, defs = ''): string {
  const marge = 0.06 * Math.max(boite.x1 - boite.x0, boite.y1 - boite.y0);
  const x = boite.x0 - marge;
  const y = boite.y0 - marge;
  const w = boite.x1 - boite.x0 + 2 * marge;
  const h = boite.y1 - boite.y0 + 2 * marge;
  return (
    `<svg class="dessin" viewBox="${co(x)} ${co(y)} ${co(w)} ${co(h)}" role="img" aria-label="${label}">` +
    (defs === '' ? '' : `<defs>${defs}</defs>`) +
    contenu.join('') +
    '</svg>'
  );
}

// ---------------------------------------------------------------------------
// Tete d'ancrage
// ---------------------------------------------------------------------------

/**
 * Vue en plan : platine, ames, couronne, percage ; en appui continu, le
 * contour efficace du troncon en te (couronne et ames elargies de c), ecrete
 * a la platine ; en appui aux extremites, les lignes d'appui.
 *
 * Repere du dessin : x horizontal = direction b (perpendiculaire aux ames),
 * y vertical = direction h (parallele aux ames).
 */
export function planChaise(c: Extract<Calcul, { detail: 'chaise-ancrage' }>): string {
  const { platine, plats, ancrage, schema } = c.modele.donnees.assemblage;
  const ex = ancrage.excentrement ?? 0;
  const b = platine.b;
  const h = platine.h;
  const contenu: string[] = [rect('acier', -b / 2, -h / 2, b / 2, h / 2)];

  const tr = c.resultat.platine.troncon;
  let defs = '';
  if (schema === 'appui-continu' && tr !== null) {
    defs = `<clipPath id="platine-utile">${rect('acier', -b / 2, -h / 2, b / 2, h / 2)}</clipPath>`;
    const clip = ' clip-path="url(#platine-utile)"';
    contenu.push(cercle('contour-c', ex, 0, ancrage.D / 2 + tr.c, clip));
    if (tr.amesDansLeContour) {
      for (const s of [-1, 1]) {
        contenu.push(
          rect(
            'contour-c',
            s * plats.e / 2 - plats.t_w / 2 - tr.c,
            -plats.L_w / 2 - tr.c,
            s * plats.e / 2 + plats.t_w / 2 + tr.c,
            plats.L_w / 2 + tr.c,
            clip,
          ),
        );
      }
    }
  }
  for (const s of [-1, 1]) {
    contenu.push(rect('acier-coupe', s * plats.e / 2 - plats.t_w / 2, -plats.L_w / 2, s * plats.e / 2 + plats.t_w / 2, plats.L_w / 2));
  }
  contenu.push(cercle('couronne', ex, 0, ancrage.D / 2));
  contenu.push(cercle('percage', ex, 0, platine.d_0 / 2));
  contenu.push(ligne('axe', ex, -h / 2, ex, h / 2));
  if (schema === 'appui-extremites' && plats.L !== undefined) {
    for (const s of [-1, 1]) contenu.push(ligne('appui', -b / 2, (s * plats.L) / 2, b / 2, (s * plats.L) / 2));
  }
  const demi = Math.max(h / 2, schema === 'appui-extremites' ? (plats.L ?? 0) / 2 : 0);
  return svg({ x0: -b / 2, y0: -demi, x1: b / 2, y1: demi }, contenu, 'Vue en plan de la tete d ancrage', defs);
}

/**
 * Coupe perpendiculaire aux ames, par l'axe du tirant : support, platine
 * percee, ames et leurs cordons, bloc d'ancrage, diffusion a 45 degres de la
 * couronne dans l'epaisseur de la platine.
 *
 * Repere : x = direction b, y vers le BAS (convention SVG), support en bas.
 */
export function coupeChaise(c: Extract<Calcul, { detail: 'chaise-ancrage' }>): string {
  const { platine, plats, soudure, ancrage, appui, schema } = c.modele.donnees.assemblage;
  const ex = ancrage.excentrement ?? 0;
  const { b, t, d_0 } = platine;
  const { h_w, t_w, e } = plats;
  const z = soudure.a * Math.SQRT2; // cote du cordon
  // y = 0 : face de la platine cote ames ; y = t : face cote support.
  const contenu: string[] = [];
  const hSupport = Math.max(0.35 * h_w, 2 * t);
  if (appui.type === 'beton' && schema === 'appui-continu') {
    contenu.push(rect('beton', -b / 2 - 0.15 * b, t, b / 2 + 0.15 * b, t + hSupport));
  } else {
    // Appuis hors du plan de coupe : on signale seulement le support.
    contenu.push(ligne('appui', -b / 2 - 0.15 * b, t + hSupport / 3, b / 2 + 0.15 * b, t + hSupport / 3));
  }
  // Platine en deux morceaux de part et d'autre du percage.
  contenu.push(rect('acier-coupe', -b / 2, 0, ex - d_0 / 2, t));
  contenu.push(rect('acier-coupe', ex + d_0 / 2, 0, b / 2, t));
  for (const s of [-1, 1]) {
    const x = (s * e) / 2;
    contenu.push(rect('acier', x - t_w / 2, -h_w, x + t_w / 2, 0));
    // Cordons d'angle au pied de chaque ame, des deux cotes.
    contenu.push(poly('soudure', [[x + t_w / 2, 0], [x + t_w / 2 + z, 0], [x + t_w / 2, -z]]));
    contenu.push(poly('soudure', [[x - t_w / 2, 0], [x - t_w / 2 - z, 0], [x - t_w / 2, -z]]));
  }
  // Bloc d'ancrage sur la couronne, et diffusion a 45 degres.
  const hBloc = Math.min(0.45 * ancrage.D, 0.7 * h_w);
  contenu.push(rect('bloc', ex - ancrage.D / 2, -hBloc, ex + ancrage.D / 2, 0));
  for (const s of [-1, 1]) {
    contenu.push(ligne('diffusion', ex + (s * ancrage.D) / 2, 0, ex + s * (ancrage.D / 2 + t), t));
  }
  contenu.push(ligne('axe', ex, -1.25 * h_w, ex, t + hSupport));
  // Le tirant tire le bloc vers le support.
  contenu.push(fleche(ex, t + hSupport * 0.3, t + hSupport * 0.95, Math.max(8, 0.06 * b)));
  return svg(
    { x0: -b / 2 - 0.15 * b, y0: -1.25 * h_w, x1: b / 2 + 0.15 * b, y1: t + hSupport },
    contenu,
    'Coupe de la tete d ancrage',
  );
}

// ---------------------------------------------------------------------------
// Te, cruciforme, angle
// ---------------------------------------------------------------------------

/** Coupe du plat soude, perpendiculaire au cordon. */
export function coupeTe(c: Extract<Calcul, { detail: 'te' }>): string {
  const d = c.modele.donnees;
  const { t_p, t_b } = d;
  const { type, a, cotes } = d.soudure;
  const hP = Math.max(4 * t_p, 6 * a, 60);
  const largeur = Math.max(8 * t_p, 2 * hP);
  const z = a * Math.SQRT2;
  const contenu: string[] = [];

  // Piece de base : y dans [0 ; t_b], plat attache au-dessus (y < 0).
  // Assemblage d'angle : la piece de base s'arrete au droit du plat, cordon exterieur compris.
  const xBase0 = d.nature === 'angle' ? -t_p / 2 - (type === 'angle' ? z : 0) : -largeur / 2;
  contenu.push(rect('acier-coupe', xBase0, 0, largeur / 2, t_b));
  contenu.push(rect('acier', -t_p / 2, -hP, t_p / 2, 0));
  if (d.nature === 'cruciforme') {
    contenu.push(rect('acier', -t_p / 2, t_b, t_p / 2, t_b + hP));
  }

  const soudures = (y0: number, sens: 1 | -1): void => {
    // sens -1 : plat au-dessus (y decroissant), +1 : plat en dessous.
    const cotesSoudes: Array<1 | -1> = type === 'penetration-totale' || cotes === 2 ? [1, -1] : [1];
    for (const s of cotesSoudes) {
      const bord = (s * t_p) / 2;
      if (type === 'angle') {
        contenu.push(poly('soudure', [[bord, y0], [bord + s * z, y0], [bord, y0 + sens * z]]));
      } else {
        const p = type === 'penetration-totale' ? t_p / 2 : a;
        contenu.push(poly('soudure', [[bord, y0], [bord - s * p, y0], [bord, y0 + sens * p]]));
      }
    }
  };
  soudures(0, -1);
  if (d.nature === 'cruciforme') soudures(t_b, 1);

  const taille = Math.max(6, 0.05 * largeur);
  if (d.sollicitations.N !== 0) {
    const vers = d.sollicitations.N > 0 ? -1 : 1;
    contenu.push(fleche(0, -hP * (vers < 0 ? 0.55 : 1.1), -hP * (vers < 0 ? 1.1 : 0.55), taille));
  }
  const bas = d.nature === 'cruciforme' ? t_b + hP : t_b;
  return svg({ x0: -largeur / 2, y0: -1.15 * hP, x1: largeur / 2, y1: bas }, contenu, 'Coupe du plat soude');
}

// ---------------------------------------------------------------------------
// Recouvrement
// ---------------------------------------------------------------------------

/** Vue en plan du recouvrement ; x en travers, y le long de l'effort. */
export function planRecouvrement(c: Extract<Calcul, { detail: 'recouvrement' }>): string {
  const d = c.modele.donnees;
  const { b_p, b_b, L_r } = d;
  const lBase = 1.6 * L_r + 40;
  const lPlat = 1.6 * L_r + 40;
  // Plat de base : de y = -lBase a y = L_r ; plat attache : de y = 0 a y = L_r + lPlat.
  const contenu: string[] = [
    rect('acier', -b_b / 2, -lBase, b_b / 2, L_r),
    rect('acier-coupe', -b_p / 2, 0, b_p / 2, L_r + lPlat),
  ];
  if (d.cordons.lateraux) {
    contenu.push(ligne('cordon', b_p / 2, 0, b_p / 2, L_r));
    contenu.push(ligne('cordon', -b_p / 2, 0, -b_p / 2, L_r));
  }
  if (d.cordons.frontal) contenu.push(ligne('cordon', -b_p / 2, 0, b_p / 2, 0));
  const taille = Math.max(8, 0.06 * b_b);
  contenu.push(fleche(0, L_r + 0.4 * lPlat, L_r + 0.95 * lPlat, taille));
  const demi = Math.max(b_b, b_p) / 2;
  return svg({ x0: -demi, y0: -lBase, x1: demi, y1: L_r + lPlat }, contenu, 'Vue en plan du recouvrement');
}

// ---------------------------------------------------------------------------
// Profile sur platine
// ---------------------------------------------------------------------------

/** Vue en plan de la section soudee et de ses cordons ; x selon b, y selon h. */
export function planProfile(c: Extract<Calcul, { detail: 'profile-platine' }>): string {
  const d = c.modele.donnees;
  const { h, b, t_w, t_f } = d;
  const contenu: string[] = [];
  const marge = Math.max(0.15 * Math.max(h, b), 3 * d.a_f);
  contenu.push(rect('acier', -b / 2 - marge, -h / 2 - marge, b / 2 + marge, h / 2 + marge));
  contenu.push(rect('acier-coupe', -b / 2, -h / 2, b / 2, -h / 2 + t_f));
  contenu.push(rect('acier-coupe', -b / 2, h / 2 - t_f, b / 2, h / 2));
  contenu.push(rect('acier-coupe', -t_w / 2, -h / 2 + t_f, t_w / 2, h / 2 - t_f));
  for (const s of [-1, 1]) {
    const yExt = s * (h / 2 + d.a_f / 2);
    const yInt = s * (h / 2 - t_f - d.a_f / 2);
    contenu.push(ligne('cordon', -b / 2, yExt, b / 2, yExt));
    contenu.push(ligne('cordon', t_w / 2, yInt, b / 2, yInt));
    contenu.push(ligne('cordon', -b / 2, yInt, -t_w / 2, yInt));
    const xAme = s * (t_w / 2 + d.a_w / 2);
    contenu.push(ligne('cordon', xAme, -h / 2 + t_f, xAme, h / 2 - t_f));
  }
  return svg(
    { x0: -b / 2 - marge, y0: -h / 2 - marge, x1: b / 2 + marge, y1: h / 2 + marge },
    contenu,
    'Vue en plan du profile et de ses cordons',
  );
}

export interface Dessin {
  titre: string;
  svg: string;
  legende: string;
}

/** Les dessins du detail courant, avec leur legende. */
export function dessinsDuCalcul(c: Calcul): Dessin[] {
  switch (c.detail) {
    case 'chaise-ancrage':
      return [
        {
          titre: 'Vue en plan',
          svg: planChaise(c),
          legende:
            c.modele.donnees.assemblage.schema === 'appui-continu'
              ? "Ames en coupe, couronne d'appui, percage. Tirets : contour efficace du troncon en te (couronne et ames elargies de c), ecrete a la platine."
              : "Ames en coupe, couronne d'appui, percage. Traits forts : lignes d'appui, a la portee L.",
        },
        {
          titre: 'Coupe',
          svg: coupeChaise(c),
          legende:
            "Platine sur le support, ames soudees sur sa face libre, bloc d'ancrage entre elles. Tirets : diffusion a 45 degres de la couronne dans l'epaisseur.",
        },
      ];
    case 'te':
      return [{ titre: 'Coupe', svg: coupeTe(c), legende: 'Piece de base en coupe, plat attache, soudures en noir. Fleche : effort N.' }];
    case 'recouvrement':
      return [
        {
          titre: 'Vue en plan',
          svg: planRecouvrement(c),
          legende: "Plat de base (clair), plat attache (fonce), cordons en trait fort. Fleche : effort N.",
        },
      ];
    case 'profile-platine':
      return [
        {
          titre: 'Vue en plan',
          svg: planProfile(c),
          legende: 'Section du profile sur la platine ; traits forts : cordons, a la position de leur gorge rabattue.',
        },
      ];
  }
}
