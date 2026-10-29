/**
 * Dessins a l'echelle, en SVG. Module PUR : il rend des chaines.
 *
 * Toutes les longueurs sont en millimetres du modele ; le `viewBox` fait
 * l'echelle. Les dessins de la tete d'ancrage portent des cotes et des
 * etiquettes, a une taille de police proportionnelle a la taille du dessin ;
 * les autres n'ont pas de texte, et leurs legendes vivent dans la page.
 *
 * ⚠ Toute classe emise ici doit avoir sa regle dans `STYLES_TRACE`
 * (export.ts), faute de quoi les dessins exportes sortent en aplat noir. Un
 * test le verifie.
 */

import { nombreAffiche } from 'aedificium-ui';

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
  'cote',
  'repere',
  'texte',
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
// Cotes et etiquettes (tete d'ancrage)
// ---------------------------------------------------------------------------

/** Nombre d'une cote ou d'une etiquette. */
function n(v: number): string {
  return nombreAffiche(v, 1);
}

/** Texte de dessin ; `fs` est la taille de police, en mm du modele. */
function texte(x: number, y: number, contenu: string, fs: number, ancre: 'start' | 'middle' | 'end' = 'start'): string {
  return (
    `<text class="texte" x="${co(x)}" y="${co(y)}" font-size="${co(fs)}" ` +
    `text-anchor="${ancre}" dominant-baseline="middle">${contenu}</text>`
  );
}

/** Symbole indice suivi de `suite` : `t` indice `w`, puis ` = 20`. */
function indice(lettre: string, ind: string, suite: string, fs: number): string {
  const d = co(0.3 * fs);
  return `${lettre}<tspan dy="${d}" font-size="${co(0.75 * fs)}">${ind}</tspan><tspan dy="-${d}">${suite}</tspan>`;
}

/** Largeur approchee d'un texte, pour reserver sa place dans le cadre. */
function largeurTexte(contenu: string, fs: number): number {
  return 0.56 * fs * contenu.replace(/<[^>]+>/g, '').length;
}

/** Trait oblique d'extremite de cote. */
function tiret(x: number, y: number, fs: number): string {
  const k = 0.3 * fs;
  return ligne('cote', x - k, y + k, x + k, y - k);
}

/**
 * Cote horizontale de x1 a x2, tracee a l'ordonnee y ; les lignes d'attache
 * partent de l'objet (yRef1 sous x1, yRef2 sous x2). Le texte se place du cote
 * oppose a l'objet.
 */
function coteH(x1: number, x2: number, y: number, yRef1: number, yRef2: number, contenu: string, fs: number): string {
  const s = Math.sign(y - yRef1) || -1;
  return (
    ligne('cote', x1, yRef1 + s * 0.25 * fs, x1, y + s * 0.35 * fs) +
    ligne('cote', x2, yRef2 + s * 0.25 * fs, x2, y + s * 0.35 * fs) +
    ligne('cote', x1, y, x2, y) +
    tiret(x1, y, fs) +
    tiret(x2, y, fs) +
    texte((x1 + x2) / 2, y + s * 0.8 * fs, contenu, fs, 'middle')
  );
}

/** Cote verticale de y1 a y2 a l'abscisse x ; texte horizontal, a l'exterieur. */
function coteV(y1: number, y2: number, x: number, xRef1: number, xRef2: number, contenu: string, fs: number): string {
  const s = Math.sign(x - xRef1) || -1;
  return (
    ligne('cote', xRef1 + s * 0.25 * fs, y1, x + s * 0.35 * fs, y1) +
    ligne('cote', xRef2 + s * 0.25 * fs, y2, x + s * 0.35 * fs, y2) +
    ligne('cote', x, y1, x, y2) +
    tiret(x, y1, fs) +
    tiret(x, y2, fs) +
    texte(x + s * 0.5 * fs, (y1 + y2) / 2, contenu, fs, s < 0 ? 'end' : 'start')
  );
}

interface Etiquette {
  /** Point designe, dans le dessin. */
  x: number;
  y: number;
  contenu: string;
}

/**
 * Etiquettes en colonne a partir de `xCol`, reliees a leur point par un trait
 * de rappel. Rangees par ordonnee, espacees d'au moins 1,5 fs.
 */
function etiquettes(liste: Etiquette[], xCol: number, fs: number): { svg: string; x1: number; y0: number; y1: number } {
  const triees = [...liste].sort((p, q) => p.y - q.y);
  let svgEtiq = '';
  let precedente = -Infinity;
  let x1 = xCol;
  let y0 = Infinity;
  for (const e of triees) {
    const y = Math.max(e.y, precedente + 1.5 * fs);
    precedente = y;
    y0 = Math.min(y0, y);
    svgEtiq +=
      cercle('repere', e.x, e.y, 0.15 * fs) + ligne('repere', e.x, e.y, xCol - 0.3 * fs, y) + texte(xCol, y, e.contenu, fs);
    x1 = Math.max(x1, xCol + largeurTexte(e.contenu, fs));
  }
  return { svg: svgEtiq, x1, y0: y0 - fs, y1: precedente + fs };
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
  const extremites = schema === 'appui-extremites' && plats.L !== undefined;
  if (extremites) {
    for (const s of [-1, 1]) contenu.push(ligne('appui', -b / 2, (s * (plats.L ?? 0)) / 2, b / 2, (s * (plats.L ?? 0)) / 2));
  }
  const demi = Math.max(h / 2, plats.L_w / 2, extremites ? (plats.L ?? 0) / 2 : 0);
  const fs = 0.045 * Math.max(b, 2 * demi);

  // Cotes : b dessous, h a gauche, e (entre axes des ames) dessus.
  const yB = demi + 2 * fs;
  contenu.push(coteH(-b / 2, b / 2, yB, h / 2, h / 2, `b = ${n(b)}`, fs));
  const xH = -b / 2 - 2 * fs;
  const texteH = `h = ${n(h)}`;
  contenu.push(coteV(-h / 2, h / 2, xH, -b / 2, -b / 2, texteH, fs));
  const yE = -demi - 2 * fs;
  contenu.push(coteH(-plats.e / 2, plats.e / 2, yE, -plats.L_w / 2, -plats.L_w / 2, `e = ${n(plats.e)}`, fs));

  // Etiquettes, en colonne a droite de la platine.
  const bordAme = plats.e / 2 + plats.t_w / 2;
  const liste: Etiquette[] = [
    { x: bordAme < 0.48 * b ? (b / 2 + bordAme) / 2 : 0.48 * b, y: -0.42 * h, contenu: `Platine, t = ${n(platine.t)}` },
    { x: plats.e / 2, y: -0.3 * plats.L_w, contenu: `Âme, ${indice('t', 'w', ` = ${n(plats.t_w)}`, fs)}` },
    { x: ex + 0.3536 * ancrage.D, y: -0.3536 * ancrage.D, contenu: `Couronne d'appui, Ø D = ${n(ancrage.D)}` },
    { x: ex + 0.3536 * platine.d_0, y: 0.3536 * platine.d_0, contenu: `Perçage, Ø d₀ = ${n(platine.d_0)}` },
  ];
  if (schema === 'appui-continu' && tr !== null) {
    liste.push({ x: ex, y: 0.93 * Math.min(ancrage.D / 2 + tr.c, h / 2), contenu: `Contour efficace, c = ${n(tr.c)}` });
  }
  if (extremites) liste.push({ x: 0.35 * b, y: (plats.L ?? 0) / 2, contenu: `Ligne d'appui, L = ${n(plats.L ?? 0)}` });
  const et = etiquettes(liste, b / 2 + 1.5 * fs, fs);
  contenu.push(et.svg);

  return svg(
    {
      x0: xH - 0.5 * fs - largeurTexte(texteH, fs),
      y0: Math.min(yE - 1.4 * fs, et.y0),
      x1: et.x1,
      y1: Math.max(yB + 1.4 * fs, et.y1),
    },
    contenu,
    "Vue en plan de la tête d'ancrage",
    defs,
  );
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
  // Tirant (diametre figuratif, sous le percage) et ecrou sur le bloc.
  const dT = 0.75 * d_0;
  const hEcrou = 0.8 * dT;
  const lEcrou = 1.7 * dT;
  const yHaut = -hBloc - hEcrou - 0.35 * dT;
  const yBas = t + hSupport;
  contenu.push(rect('acier', ex - dT / 2, yHaut, ex + dT / 2, yBas));
  contenu.push(rect('acier', ex - lEcrou / 2, -hBloc - hEcrou, ex + lEcrou / 2, -hBloc));
  contenu.push(ligne('axe', ex, yHaut - 0.15 * h_w, ex, yBas));

  const fs = 0.045 * Math.max(1.3 * b, h_w + t + hSupport);
  // Le tirant tire le bloc vers le support.
  contenu.push(fleche(ex, yBas + 0.4 * fs, yBas + 3 * fs, Math.max(8, 0.06 * b)));

  // Cotes : h_w et t en chaine a gauche, e (entre axes des ames) dessus.
  const bordGauche = -b / 2 - 0.15 * b;
  const xG = bordGauche - 1.5 * fs;
  const texteHw = indice('h', 'w', ` = ${n(h_w)}`, fs);
  contenu.push(coteV(-h_w, 0, xG, -e / 2 - t_w / 2, -b / 2, texteHw, fs));
  contenu.push(coteV(0, t, xG, -b / 2, -b / 2, `t = ${n(t)}`, fs));
  const yE = Math.min(-h_w, yHaut - 0.15 * h_w) - 1.5 * fs;
  contenu.push(coteH(-e / 2, e / 2, yE, -h_w, -h_w, `e = ${n(e)}`, fs));

  // Etiquettes, en colonne a droite du support.
  const pied = e / 2 + t_w / 2;
  const liste: Etiquette[] = [
    { x: e / 2, y: -0.75 * h_w, contenu: 'Âme' },
    { x: ex + 0.3 * lEcrou, y: -hBloc - hEcrou / 2, contenu: 'Écrou' },
    { x: ex + 0.4 * ancrage.D, y: -hBloc / 2, contenu: `Bloc d'ancrage, Ø D = ${n(ancrage.D)}` },
    { x: pied + z / 3, y: -z / 3, contenu: `Cordon, a = ${n(soudure.a)}` },
    { x: pied + z < b / 2 ? (pied + z + b / 2) / 2 : 0.45 * b, y: t / 2, contenu: 'Platine' },
    { x: ex + dT / 2, y: t + 0.65 * hSupport, contenu: 'Tirant' },
    appui.type === 'beton' && schema === 'appui-continu'
      ? { x: b / 2 + 0.08 * b, y: t + 0.4 * hSupport, contenu: 'Support en béton' }
      : { x: b / 2 + 0.08 * b, y: t + hSupport / 3, contenu: 'Support (appuis hors coupe)' },
  ];
  const et = etiquettes(liste, b / 2 + 0.15 * b + 1.5 * fs, fs);
  contenu.push(et.svg);

  return svg(
    {
      x0: xG - 0.5 * fs - largeurTexte(texteHw, fs),
      y0: Math.min(yE - 1.4 * fs, et.y0),
      x1: et.x1,
      y1: Math.max(yBas + 3 * fs, et.y1),
    },
    contenu,
    "Coupe de la tête d'ancrage",
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
  return svg({ x0: -largeur / 2, y0: -1.15 * hP, x1: largeur / 2, y1: bas }, contenu, 'Coupe du plat soudé');
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
    'Vue en plan du profilé et de ses cordons',
  );
}

/** Vue en plan de l'eclissage ; x en travers, y le long de l'effort. */
export function planEclissage(c: Extract<Calcul, { detail: 'eclissage-boulonne' }>): string {
  const d = c.modele.donnees;
  const d_0 = c.resultat.d_0;
  const L_j = (d.n_1 - 1) * d.p_1;
  const L_r = L_j + 2 * d.e_1;
  const lBase = 0.8 * L_r + 60;
  const lPlat = 0.8 * L_r + 60;
  const contenu: string[] = [
    rect('acier', -d.b_b / 2, -lBase, d.b_b / 2, L_r),
    rect('acier-coupe', -d.b_p / 2, 0, d.b_p / 2, L_r + lPlat),
  ];
  const largeur = (d.n_2 - 1) * d.p_2;
  for (let i = 0; i < d.n_1; i++) {
    for (let j = 0; j < d.n_2; j++) {
      contenu.push(cercle('percage', -largeur / 2 + j * d.p_2, d.e_1 + i * d.p_1, d_0 / 2));
    }
  }
  const taille = Math.max(8, 0.06 * d.b_b);
  contenu.push(fleche(0, L_r + 0.4 * lPlat, L_r + 0.95 * lPlat, taille));
  const demi = Math.max(d.b_b, d.b_p) / 2;
  return svg({ x0: -demi, y0: -lBase, x1: demi, y1: L_r + lPlat }, contenu, "Vue en plan de l'éclissage boulonné");
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
              ? "Cotes en mm. Tirets : contour efficace du tronçon en té (couronne et âmes élargies de c), écrêté à la platine."
              : "Cotes en mm. Traits forts : lignes d'appui, à la portée L.",
        },
        {
          titre: 'Coupe',
          svg: coupeChaise(c),
          legende:
            "Coupe par l'axe du tirant, cotes en mm ; le diamètre du tirant est figuratif. Tirets : diffusion à 45 degrés de la couronne dans l'épaisseur. Flèche : effort du tirant.",
        },
      ];
    case 'te':
      return [{ titre: 'Coupe', svg: coupeTe(c), legende: 'Élément de base en coupe, plat attaché, soudures en noir. Flèche : effort N.' }];
    case 'recouvrement':
      return [
        {
          titre: 'Vue en plan',
          svg: planRecouvrement(c),
          legende: 'Plat de base (clair), plat attaché (foncé), cordons en trait fort. Flèche : effort N.',
        },
      ];
    case 'eclissage-boulonne':
      return [
        {
          titre: 'Vue en plan',
          svg: planEclissage(c),
          legende: 'Plat de base (clair), plat attaché (foncé), trous à d₀. Flèche : effort N.',
        },
      ];
    case 'profile-platine':
      return [
        {
          titre: 'Vue en plan',
          svg: planProfile(c),
          legende: 'Section du profilé sur la platine ; traits forts : cordons, à la position de leur gorge rabattue.',
        },
      ];
  }
}
