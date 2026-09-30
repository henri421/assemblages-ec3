/**
 * Mise en forme des resultats : verdict, constats, taux, dispositions,
 * grandeurs intermediaires.
 *
 * Module PUR : il rend des chaines. Aucune valeur n'y est calculee — toutes
 * viennent du noyau. Les memes blocs servent a l'ecran, au CSV et a la note
 * de calcul : ce qui s'affiche est ce qui s'exporte.
 */

import { tauxFr } from 'aedificium-ui';
import type {
  ConstatRegle,
  ResultatCordons,
  ResultatDispositions,
  Taux,
  VerificationCas,
} from '../../src/index';
import type { Calcul } from './calcul';
import { avecUnite, echapper, nombreFr } from './format';

export interface Ligne {
  symbole: string;
  libelle: string;
  valeur: string;
}

export interface Bloc {
  titre: string;
  lignes: Ligne[];
  /** Precision ou motif d'indisponibilite ; null s'il n'y en a pas. */
  note: string | null;
}

const l = (symbole: string, libelle: string, valeur: string): Ligne => ({ symbole, libelle, valeur });

/** Message d'erreur lisible, quelle que soit la nature de ce qui a ete leve. */
export function messageDErreur(erreur: unknown): string {
  const detail =
    erreur instanceof Error && erreur.message !== '' ? erreur.message : 'cause inconnue. Verifiez les valeurs saisies.';
  return `Calcul impossible : ${detail}`;
}

// ---------------------------------------------------------------------------
// Verdict et constats
// ---------------------------------------------------------------------------

export function titreDuVerdict(verdict: string): string {
  switch (verdict) {
    case 'conforme':
      return 'Conforme';
    case 'non-conforme-resistance':
      return 'Non conforme : resistance';
    case 'non-conforme-service':
      return 'Non conforme : service (TA 2020)';
    case 'non-conforme-dispositions':
      return 'Non conforme : dispositions constructives';
    default:
      return verdict;
  }
}

export function classeDuVerdict(verdict: string): string {
  return verdict === 'conforme' ? 'verdict-ok' : verdict === 'non-conforme-resistance' ? 'verdict-refus' : 'verdict-alerte';
}

interface ConstatAffiche {
  nom: string;
  ok: boolean | null;
  motif: string;
}

/** Les constats, DISTINCTS : resistance, service (tete d'ancrage), dispositions. */
export function constatsDuCalcul(c: Calcul): ConstatAffiche[] {
  const r = c.resultat;
  const liste: ConstatAffiche[] = [{ nom: 'Resistance', ok: r.constats.resistance.ok, motif: r.constats.resistance.motif }];
  if (c.detail === 'chaise-ancrage') {
    const s = c.resultat.constats.service;
    liste.push(
      s === null
        ? { nom: 'Service', ok: null, motif: 'non examine : traction de blocage non saisie' }
        : { nom: 'Service', ok: s.ok, motif: s.motif },
    );
  }
  liste.push({ nom: 'Dispositions', ok: r.constats.dispositions.ok, motif: r.constats.dispositions.motif });
  return liste;
}

function htmlConstats(c: Calcul): string {
  return (
    '<ul class="constats">' +
    constatsDuCalcul(c)
      .map((k) => {
        const etat = k.ok === null ? 'sans-objet' : k.ok ? 'ok' : 'refus';
        const mot = k.ok === null ? 'non examine' : k.ok ? 'satisfait' : 'non satisfait';
        return (
          `<li class="constat constat-${etat}" data-constat="${k.nom.toLowerCase()}">` +
          `<span class="constat-nom">${echapper(k.nom)}</span>` +
          `<span class="constat-etat">${mot}</span>` +
          `<span class="constat-motif">${echapper(k.motif)}</span></li>`
        );
      })
      .join('') +
    '</ul>'
  );
}

// ---------------------------------------------------------------------------
// Taux de travail
// ---------------------------------------------------------------------------

/** Tableau des taux, dans l'ordre du noyau (decroissant, sans-objet a la fin). */
export function htmlTaux(taux: readonly Taux[]): string {
  const lignes = taux
    .map((t) => {
      if (!t.applicable) {
        return (
          `<tr class="sans-objet" data-taux="${t.id}"><td class="libelle">${echapper(t.libelle)}</td>` +
          `<td class="clause">${echapper(t.clause)}</td>` +
          `<td class="valeur" colspan="2">sans objet : ${echapper(t.notApplicableReason ?? '')}</td></tr>`
        );
      }
      const depasse = t.valeur > 1;
      const largeur = Math.min(100, Math.max(0, t.valeur * 100));
      return (
        `<tr data-taux="${t.id}" class="${depasse ? 'depasse' : ''}">` +
        `<td class="libelle">${echapper(t.libelle)}${t.famille === 'service' ? ' <em>(service)</em>' : ''}</td>` +
        `<td class="clause">${echapper(t.clause)}</td>` +
        `<td class="valeur">${tauxFr(t.valeur)}</td>` +
        `<td class="barre"><span class="jauge"><span style="width:${largeur.toFixed(1)}%"></span></span></td></tr>`
      );
    })
    .join('');
  return (
    '<table class="taux"><thead><tr><th>Mecanisme</th><th>Clause</th><th>Taux</th><th></th></tr></thead>' +
    `<tbody>${lignes}</tbody></table>`
  );
}

// ---------------------------------------------------------------------------
// Dispositions
// ---------------------------------------------------------------------------

function etatRegle(c: ConstatRegle): string {
  if (!c.applicable) return 'sans objet';
  if (c.severite === 'information') return 'information';
  return c.satisfaite ? 'satisfaite' : c.severite === 'bloquante' ? 'enfreinte' : 'a surveiller';
}

export function htmlDispositions(d: ResultatDispositions): string {
  const lignes = d.constats
    .map(
      (c) =>
        `<tr data-regle="${c.id}" class="regle-${etatRegle(c).replace(/ /g, '-')}">` +
        `<td class="libelle">${echapper(c.enonce)}</td><td class="clause">${echapper(c.clause)}</td>` +
        `<td>${c.severite}</td><td>${etatRegle(c)}</td>` +
        `<td class="motif">${echapper(c.motif ?? c.notApplicableReason ?? '')}</td></tr>`,
    )
    .join('');
  return (
    '<table class="dispositions"><thead><tr><th>Regle</th><th>Clause</th><th>Severite</th><th>Etat</th>' +
    `<th>Constat</th></tr></thead><tbody>${lignes}</tbody></table>`
  );
}

/** Alertes d'assistance a la saisie : violations et avertissements seulement. */
export function htmlAssistance(d: ResultatDispositions | null): string {
  if (d === null) return '';
  const alertes = [...d.violations, ...d.avertissements];
  if (alertes.length === 0) return '<p class="assistance-ok">Aucune disposition enfreinte.</p>';
  return `<ul class="assistance">${alertes.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// Cordons
// ---------------------------------------------------------------------------

function htmlPointsGroupe(r: ResultatCordons): string {
  const lignes = r.points
    .map((p) => {
      const d = p.directionnelle;
      const gouv = p === r.gouvernant ? ' class="gouvernant"' : '';
      return (
        `<tr${gouv}><td>${echapper(p.cordon)} / ${p.extremite}</td>` +
        `<td>${nombreFr(d.sigma_perp, 1)}</td><td>${nombreFr(d.tau_perp, 1)}</td><td>${nombreFr(d.tau_para, 1)}</td>` +
        `<td>${tauxFr(d.tauxEquivalent)}</td>` +
        `<td>${d.tauxNormal === null ? 'n.a.' : tauxFr(d.tauxNormal)}</td>` +
        `<td>${tauxFr(p.simplifiee.taux)}</td></tr>`
      );
    })
    .join('');
  return enteteCordons() + `<tbody>${lignes}</tbody></table>`;
}

function htmlCasChaise(verifs: readonly VerificationCas[], gouvernant: VerificationCas): string {
  const lignes = verifs
    .map((v) => {
      const d = v.directionnelle;
      const gouv = v === gouvernant ? ' class="gouvernant"' : '';
      return (
        `<tr${gouv}><td>${echapper(v.cas.libelle)}</td>` +
        `<td>${nombreFr(d.sigma_perp, 1)}</td><td>${nombreFr(d.tau_perp, 1)}</td><td>${nombreFr(d.tau_para, 1)}</td>` +
        `<td>${tauxFr(d.tauxEquivalent)}</td>` +
        `<td>${d.tauxNormal === null ? 'n.a.' : tauxFr(d.tauxNormal)}</td>` +
        `<td>${tauxFr(v.simplifiee.taux)}</td></tr>`
      );
    })
    .join('');
  return enteteCordons() + `<tbody>${lignes}</tbody></table>`;
}

function enteteCordons(): string {
  return (
    '<table class="cordons"><thead><tr><th>Cordon</th><th>&sigma;<sub>&perp;</sub></th>' +
    '<th>&tau;<sub>&perp;</sub></th><th>&tau;<sub>//</sub></th><th>critere 1</th>' +
    '<th>0,9 f<sub>u</sub></th><th>simplifiee</th></tr></thead>'
  );
}

/** Tableau des cordons : chaque point verifie, le gouvernant en evidence. */
export function htmlCordons(c: Calcul): string {
  if (c.detail === 'chaise-ancrage') {
    const s = c.resultat.soudures;
    return htmlCasChaise(s.verifications, s.gouvernant);
  }
  const cordons = c.resultat.cordons;
  return cordons === null ? '<p class="note">Pleine penetration : aucune gorge a verifier (§4.7.1).</p>' : htmlPointsGroupe(cordons);
}

/**
 * Note sur les methodes. En cisaillement longitudinal pur, les deux methodes
 * COINCIDENT : on le dit, plutot que de montrer deux fois le meme nombre
 * comme s'il s'agissait de deux constats.
 */
export function noteMethodes(c: Calcul): string {
  const coincident =
    c.detail === 'chaise-ancrage' ? c.resultat.soudures.methodesCoincident : c.resultat.cordons?.methodesCoincident ?? false;
  return coincident
    ? 'Cisaillement longitudinal pur au point gouvernant : les methodes directionnelle (§4.5.3.2) et simplifiee (§4.5.3.3) coincident exactement.'
    : 'Le verdict retient la methode directionnelle (§4.5.3.2) ; la methode simplifiee (§4.5.3.3), toujours plus severe, est donnee pour controle.';
}

// ---------------------------------------------------------------------------
// Grandeurs intermediaires
// ---------------------------------------------------------------------------

const mm = (x: number, d = 1): string => avecUnite(x, d, 'mm');
const kN = (x: number, d = 1): string => avecUnite(x, d, 'kN');
const kNm = (x: number, d = 2): string => avecUnite(x, d, 'kN.m');
const MPa = (x: number, d = 1): string => avecUnite(x, d, 'MPa');
const sans = (x: number, d = 3): string => nombreFr(x, d);

/** Tous les blocs de grandeurs, dans l'ordre ou on relit le calcul. */
export function blocsDuCalcul(c: Calcul): Bloc[] {
  switch (c.detail) {
    case 'chaise-ancrage':
      return blocsChaise(c);
    case 'te':
      return blocsTe(c);
    case 'recouvrement':
      return blocsRecouvrement(c);
    case 'profile-platine':
      return blocsProfile(c);
  }
}

function blocsChaise(c: Extract<Calcul, { detail: 'chaise-ancrage' }>): Bloc[] {
  const r = c.resultat;
  const e = r.effort;
  const blocs: Bloc[] = [
    {
      titre: 'Effort de dimensionnement',
      lignes: [
        l('N_ELU', 'effort ELU de la paroi', kN(e.termes.ELU)),
        l('P_p', "traction d'epreuve", e.termes.epreuve === null ? 'non saisie' : kN(e.termes.epreuve)),
        l('0,9 F_tk', "capacite de l'armature", e.termes.capaciteArmature === null ? 'non saisie' : kN(e.termes.capaciteArmature)),
        l('N_Ed', `retenu, origine : ${r.origineEffort}`, kN(r.N_Ed)),
        l('H_Ed', 'composante tangentielle', e.inclinaisonPriseEnCompte ? kN(e.H_Ed) : 'negligee (<= 3 degres)'),
      ],
      note: null,
    },
    {
      titre: 'Materiau',
      lignes: [
        l('f_y', 'platine', MPa(r.f_y_platine, 0)),
        l('f_y', 'ames', MPa(r.f_y_ame, 0)),
        l('f_u', 'piece la plus faible', MPa(r.f_u, 0)),
        l('beta_w', 'facteur de correlation, tableau 4.1', sans(r.beta_w, 2)),
      ],
      note: null,
    },
  ];

  const p = r.platine;
  const tr = p.troncon;
  if (tr !== null) {
    blocs.push({
      titre: 'Appui sur le beton (§6.2.5)',
      lignes: [
        l('f_jd', 'beta_j k_j f_cd', MPa(tr.f_jd, 2)),
        l('c', 't racine(f_y / (3 f_jd gamma_M0))', mm(tr.c)),
        l('g', 'espace couronne / ame', mm(tr.g)),
        l('A_eff', tr.amesDansLeContour ? 'couronne et ames elargies de c' : 'couronne elargie de c', avecUnite(tr.A_eff, 0, 'mm2')),
        l('F_c,Rd', 'A_eff f_jd', kN(tr.F_c_Rd)),
        l('sigma_c', 'pression moyenne', MPa(tr.sigma_c, 2)),
      ],
      note: tr.motifAmesExclues,
    });
  }
  if (p.flexion !== null && p.sectionNette !== null && p.cisaillement !== null) {
    blocs.push({
      titre: 'Platine entre les ames',
      lignes: [
        l('w', 'largeur utile min(h ; L_w)', mm(p.flexion.w)),
        l('M_Ed', 'N e / 8 (borne basse)', kNm(p.flexion.M_borneBasse)),
        l('M_Ed', 'N e / 4 (borne haute)', kNm(p.flexion.M_borneHaute)),
        l('M_Ed', 'N e / 6, retenu en predimensionnement', kNm(p.flexion.M_Ed)),
        l('M_Rd,net', '(w - d_0) t^2 f_y / (4 gamma_M0)', kNm(p.sectionNette.M_Rd_net)),
        l('tau_Ed', 'cisaillement au droit des ames', MPa(p.cisaillement.tau_Ed)),
      ],
      note: p.sectionNette.modeleDePlaqueNecessaire
        ? 'Taux superieur a 0,80 : le modele de poutre ne suffit plus, un modele de plaque est necessaire.'
        : null,
    });
  }
  blocs.push({
    titre: 'Poinconnement autour de la couronne',
    lignes: [
      l('tau_Ed', 'N / (pi D t)', MPa(p.poinconnement.tau_Ed)),
      l('tau_Rd', 'f_y / (racine(3) gamma_M0)', MPa(p.poinconnement.tau_Rd)),
    ],
    note: null,
  });

  const f = r.soudures.flux;
  const g = r.soudures.gouvernant;
  blocs.push({
    titre: 'Cordons ame-platine (§4.5.3)',
    lignes: [
      l('l_charge', 'min(l_eff ; D + 2t)', mm(f.l_charge)),
      l('part', "part de l'ame la plus chargee", sans(f.part)),
      l('F_Ed', 'effort transversal par ame (traction +)', avecUnite(f.F_Ed, 3, 'kN/mm')),
      l('m_Ed', `moment local retenu (borne : ${f.borne})`, avecUnite(f.m_Ed, 2, 'kN')),
      l('delta_F', 'm_Ed / (t_w + a)', avecUnite(f.delta_F, 3, 'kN/mm')),
      l('V_Ed', 'tranchant de la poutre en te', kN(f.V_Ed)),
      l('v_Ed', 'flux longitudinal par ame', avecUnite(f.v_Ed, 3, 'kN/mm')),
      l('sigma_perp', g.cas.libelle, MPa(g.directionnelle.sigma_perp)),
      l('tau_perp', '', MPa(g.directionnelle.tau_perp)),
      l('tau_para', '', MPa(g.directionnelle.tau_para)),
      l('f_u / (beta_w gamma_M2)', 'limite du critere 1', MPa(g.directionnelle.limiteEquivalente)),
      l('a_min', 'gorge de pleine resistance', mm(r.soudures.pleineResistance.a_min)),
    ],
    note: noteMethodes(c),
  });

  const a = r.ames;
  const fl = a.flexion;
  const lignesAmes: Ligne[] = [
    l('B_f', 'semelle participante', mm(a.section.B_f)),
    l('I', "inertie d'une poutre en te", avecUnite(a.section.I / 1e4, 1, 'cm4')),
    l('M_Ed', 'moment', kNm(fl.M_Ed)),
    l('V_Ed', 'tranchant', kN(fl.V_Ed)),
    l('M_V,Rd', 'resistance elastique, reduite par rho', kNm(fl.M_V_Rd)),
    l('V_pl,Rd', 'h_w t_w f_y / (racine(3) gamma_M0)', kN(fl.V_pl_Rd)),
    l('sigma_chant', 'chant libre (compression +)', MPa(fl.sigma_chant)),
    l('h_w / t_w', `limite torsion racine(E / 5,3 f_y) = ${nombreFr(a.torsion.limite, 2)}`, sans(a.torsion.elancement, 2)),
  ];
  if (a.lierne !== null) {
    const pl = a.lierne.gouvernant;
    lignesAmes.push(
      l('s_s', 'appui rigide sur la lierne', mm(pl.s_s)),
      l('l_y', 'longueur chargee efficace', mm(pl.l_y)),
      l('F_Rd', 'resistance de l ame de la lierne', kN(pl.F_Rd)),
      l('F_Ed', 'charge appliquee', kN(pl.F_Ed)),
    );
  }
  blocs.push({ titre: 'Ames', lignes: lignesAmes, note: a.deversement });

  if (r.interaction !== null) {
    blocs.push({
      titre: 'Interaction dans la platine (§6.2.1(5))',
      lignes: [
        l('sigma_x', 'poutre, face support', MPa(r.interaction.sigma_x_support)),
        l('sigma_z', 'flexion locale 6 m_Ed / t^2', MPa(r.interaction.sigma_z)),
        l('sigma_eq', 'von Mises', MPa(r.interaction.sigma_eq)),
      ],
      note: null,
    });
  }

  blocs.push(blocArrachement(r.epaisseur));
  if (r.service !== null) {
    const s = r.service;
    blocs.push({
      titre: 'Service au blocage (TA 2020)',
      lignes: [
        l('P_blocage', 'traction de blocage', kN(s.P_blocage)),
        l('delta', 'fleche totale', mm(s.delta, 3)),
        l('sigma / f_y', 'elasticite', sans(s.tauxElastique)),
        l('delta_lim', 'fleche admise', s.delta_lim === null ? 'non fixee' : mm(s.delta_lim, 3)),
      ],
      note: null,
    });
  }
  return blocs;
}

function blocArrachement(z: {
  a_eff: number;
  Z_a: number;
  Z_b: number;
  Z_c: number;
  Z_d: number;
  Z_e: number;
  Z_Ed: number;
  Z_Rd: number;
  qualiteRequise: string;
}): Bloc {
  return {
    titre: 'Arrachement lamellaire (EN 1993-1-10 §3.2)',
    lignes: [
      l('a_eff', 'profondeur efficace', mm(z.a_eff, 2)),
      l('Z_a + Z_b + Z_c + Z_d + Z_e', '', `${z.Z_a} + ${z.Z_b} + ${z.Z_c} + ${z.Z_d} + ${z.Z_e}`),
      l('Z_Ed', 'valeur requise', String(z.Z_Ed)),
      l('Z_Rd', 'qualite choisie', String(z.Z_Rd)),
      l('qualite', 'minimale requise', z.qualiteRequise),
    ],
    note: null,
  };
}

function blocGroupe(r: ResultatCordons, beta_w: number, f_u: number): Bloc {
  const p = r.groupe.proprietes;
  const g = r.gouvernant.directionnelle;
  return {
    titre: 'Groupe de cordons (gorges rabattues)',
    lignes: [
      l('f_u', 'piece la plus faible', MPa(f_u, 0)),
      l('beta_w', 'tableau 4.1', sans(beta_w, 2)),
      l('A_w', 'aire des gorges', avecUnite(p.A, 0, 'mm2')),
      l('I_yy', '', avecUnite(p.I_yy / 1e4, 1, 'cm4')),
      l('I_zz', '', avecUnite(p.I_zz / 1e4, 1, 'cm4')),
      l('I_p', 'polaire', avecUnite(p.I_p / 1e4, 1, 'cm4')),
      l('sigma_perp', `point gouvernant : ${r.gouvernant.cordon} / ${r.gouvernant.extremite}`, MPa(g.sigma_perp)),
      l('tau_perp', '', MPa(g.tau_perp)),
      l('tau_para', '', MPa(g.tau_para)),
      l('equivalente', 'racine(sigma^2 + 3 tau^2)', MPa(g.contrainteEquivalente)),
      l('f_u / (beta_w gamma_M2)', 'limite du critere 1', MPa(g.limiteEquivalente)),
    ],
    note: null,
  };
}

function blocMetal(titre: string, m: { sigma: number; tau: number; sigma_eq: number; limite: number }): Bloc {
  return {
    titre,
    lignes: [
      l('sigma', 'contraintes normales cumulees', MPa(m.sigma)),
      l('tau', '1,5 V / A', MPa(m.tau)),
      l('sigma_eq', 'racine(sigma^2 + 3 tau^2)', MPa(m.sigma_eq)),
      l('f_y / gamma_M0', '', MPa(m.limite)),
    ],
    note: null,
  };
}

function blocsTe(c: Extract<Calcul, { detail: 'te' }>): Bloc[] {
  const r = c.resultat;
  const blocs: Bloc[] = [];
  if (r.cordons !== null) {
    const b = blocGroupe(r.cordons, r.beta_w, r.f_u);
    b.note = noteMethodes(c);
    blocs.push(b);
  } else {
    blocs.push({ titre: 'Soudure', lignes: [], note: 'Pleine penetration : resistance de la piece la plus faible (§4.7.1).' });
  }
  if (r.pleineResistance !== null) {
    blocs.push({
      titre: 'Gorge de pleine resistance',
      lignes: [
        l('a_min', 't_p f_y beta_w gamma_M2 / (racine(2) f_u gamma_M0)', mm(r.pleineResistance.a_min, 2)),
        l('a_min / t_p', '', sans(r.pleineResistance.rapport)),
      ],
      note: r.pleineResistance.penetrationPlusEconomique
        ? 'Au-dela de 0,7 t, une penetration partielle ou totale devient plus economique.'
        : null,
    });
  }
  blocs.push(blocMetal('Plat attache au droit de la soudure', r.metal));
  blocs.push(blocArrachement(r.arrachement));
  return blocs;
}

function blocsRecouvrement(c: Extract<Calcul, { detail: 'recouvrement' }>): Bloc[] {
  const r = c.resultat;
  const b = blocGroupe(r.cordons, r.beta_w, r.f_u);
  b.lignes.push(l('beta_Lw', 'assemblage long, cordons lateraux (§4.11)', sans(r.beta_Lw)));
  b.note = noteMethodes(c);
  return [b, blocMetal('Plat attache', r.metalAttache), blocMetal('Plat de base', r.metalBase)];
}

function blocsProfile(c: Extract<Calcul, { detail: 'profile-platine' }>): Bloc[] {
  const r = c.resultat;
  const b = blocGroupe(r.cordons, r.beta_w, r.f_u);
  b.note = noteMethodes(c);
  return [b, blocArrachement(r.arrachement)];
}

function htmlBloc(b: Bloc): string {
  const lignes = b.lignes
    .map(
      (x) =>
        `<tr><th scope="row">${echapper(x.symbole)}</th><td class="libelle">${echapper(x.libelle)}</td>` +
        `<td class="valeur">${echapper(x.valeur)}</td></tr>`,
    )
    .join('');
  const note = b.note === null ? '' : `<p class="note">${echapper(b.note)}</p>`;
  return `<h3>${echapper(b.titre)}</h3>${lignes === '' ? '' : `<table class="grandeurs"><tbody>${lignes}</tbody></table>`}${note}`;
}

/**
 * Bloc de resultat complet : verdict et motif repris VERBATIM du noyau,
 * constats distincts, taux, cordons, dispositions, grandeurs.
 */
export function rendreResultat(c: Calcul): string {
  const r = c.resultat;
  return [
    `<p data-role="verdict" data-verdict="${r.verdict}" class="verdict ${classeDuVerdict(r.verdict)}">`,
    `${echapper(titreDuVerdict(r.verdict))}</p>`,
    `<p data-role="motif" class="motif">${echapper(r.motif)}</p>`,
    htmlConstats(c),
    '<h3>Taux de travail</h3>',
    htmlTaux(r.taux),
    '<h3>Cordons</h3>',
    htmlCordons(c),
    `<p class="note">${echapper(noteMethodes(c))}</p>`,
    '<h3>Dispositions constructives</h3>',
    htmlDispositions(r.dispositions),
    '<h3>Grandeurs du calcul</h3>',
    blocsDuCalcul(c).map(htmlBloc).join(''),
  ].join('');
}
