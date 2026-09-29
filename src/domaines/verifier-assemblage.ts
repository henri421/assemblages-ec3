/**
 * Verification d une tete d ancrage de tirant — EN 1993-1-8:2005.
 *
 * ┌──────────────────────────────────────────────┐
 * │  L OUTIL CONSTATE ET NE PRESCRIT PAS.        │
 * └──────────────────────────────────────────────┘
 * Il rend des contraintes, des taux de travail et la gorge qui satisfait
 * l inequation normative. Jamais un detail de soudure a executer, jamais un
 * plan.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa, moments en kN.m.
 *
 * Trois constats DISTINCTS, jamais fusionnes : resistance, service,
 * dispositions constructives. Une piece peut resister et rester irreguliere,
 * ou resister et se deformer au blocage au-dela de ce que le TA 2020 tolere.
 */

import { verifierAmes, type ResultatAmes } from '../ames/verifier-ames';
import { sectionEnTe } from '../ames/section-composee';
import { REGLES_CHAISE } from '../dispositions/regles';
import { verifierDispositions, type ResultatDispositions } from '../dispositions/verifier-dispositions';
import {
  CONDITIONS_PAR_DEFAUT,
  verifierArrachement,
  type ConditionsSoudage,
  type ResultatArrachement,
} from '../epaisseur/arrachement-lamellaire';
import type { Actions } from '../model/actions';
import type { Assemblage } from '../model/assemblage';
import type { Materiau } from '../model/materiau';
import { limiteElastique, resistanceUltime } from '../norms/acier';
import { betaW } from '../norms/beta-w';
import { ec3Recommande, validerProfil, type ProfilEC3 } from '../norms/ec3-recommande';
import { interactionPlatine, type ResultatInteraction } from '../platine/interaction';
import { verifierPlatine, type ResultatPlatine } from '../platine/verifier-platine';
import { verifierService, type ResultatService } from '../service/deformation-platine';
import { fluxDansLesCordons } from '../soudures/flux';
import { gorgePleineResistance } from '../soudures/pleine-resistance';
import { verifierSoudures, type ResultatSoudures } from '../soudures/verifier-soudures';
import { effortDimensionnant, type EffortDimensionnant, type OrigineEffort } from './effort-dimensionnant';
import { gouvernant, sansObjet, taux, trierTaux, type Taux } from './taux-de-travail';

export type Verdict =
  | 'conforme'
  | 'non-conforme-resistance'
  | 'non-conforme-service'
  | 'non-conforme-dispositions';

export interface DonneesAssemblage {
  assemblage: Assemblage;
  materiau: Materiau;
  actions: Actions;
  /** Profil de coefficients ; valeurs recommandees par defaut. */
  profil?: ProfilEC3;
  /** Conditions de soudage pour l arrachement lamellaire. */
  conditionsSoudage?: ConditionsSoudage;
  /** Fleche admise au blocage (mm), facultative. */
  delta_lim?: number;
}

export interface Constat {
  ok: boolean;
  motif: string;
}

export interface ResultatAssemblage {
  verdict: Verdict;
  motif: string;
  /** Les trois constats, distincts. Service : null sans traction de blocage. */
  constats: { resistance: Constat; service: Constat | null; dispositions: Constat };
  /** Terme gouvernant l effort de dimensionnement. */
  origineEffort: OrigineEffort;
  N_Ed: number;
  effort: EffortDimensionnant;
  /** Materiau lu dans les tables (MPa). */
  f_y_platine: number;
  f_y_ame: number;
  f_u: number;
  beta_w: number;
  /** Taux de travail par mecanisme, du plus sollicite au moins sollicite. */
  taux: Taux[];
  soudures: ResultatSoudures;
  platine: ResultatPlatine;
  interaction: ResultatInteraction | null;
  ames: ResultatAmes;
  epaisseur: ResultatArrachement;
  service: ResultatService | null;
  dispositions: ResultatDispositions;
  /** Mecanisme dimensionnant, pour orienter la correction. */
  mecanismeGouvernant: string;
}

const APPUI_CONTINU = 'appui continu : la platine est portee par le beton';
const SUR_LIERNE = 'appui sur lierne';

/**
 * Verification complete d une tete d ancrage.
 *
 * Ordre du calcul : effort de dimensionnement ; platine (dont l appui sur le
 * beton, qui fixe la pression que collectent les ames) ; flux dans les
 * cordons ; cordons ; ames ; arrachement lamellaire ; service ; dispositions.
 */
export function verifierAssemblage(d: DonneesAssemblage): ResultatAssemblage {
  const profil = validerProfil(d.profil ?? ec3Recommande());
  const { assemblage, materiau, actions } = d;
  const { platine, plats, soudure, ancrage, schema, appui } = assemblage;

  const effort = effortDimensionnant(actions, ancrage.inclinaison);
  const N_Ed = effort.N_Ed;

  const f_y_platine = limiteElastique(materiau.nuance, platine.t);
  const f_y_ame = limiteElastique(materiau.nuance, plats.t_w);
  const f_u = Math.min(resistanceUltime(materiau.nuance, platine.t), resistanceUltime(materiau.nuance, plats.t_w));
  const beta_w = betaW(materiau.nuance);

  if (!Number.isFinite(plats.e) || plats.e <= 0) {
    throw new Error('L entraxe des ames e doit etre un nombre strictement positif (mm).');
  }
  const ex = ancrage.excentrement ?? 0;
  const part = 0.5 + Math.abs(ex) / plats.e;

  const resPlatine = verifierPlatine(assemblage, N_Ed, part, f_y_platine, profil);

  // Flux longitudinal : en appui continu, il culmine au bord de la zone de la
  // couronne, hors du percage (section brute) ; aux extremites, le tranchant
  // regne sur toute la portee, percage compris : on retient la section qui
  // donne le plus grand S_f / I.
  const brute = sectionEnTe(platine, plats, f_y_platine, false);
  const nette = sectionEnTe(platine, plats, f_y_platine, true);
  const pourFlux =
    schema === 'appui-continu' || brute.S_f / brute.I >= nette.S_f / nette.I ? brute : nette;

  const troncon = resPlatine.troncon;
  const appuiContinu =
    schema === 'appui-continu' && troncon !== null
      ? { sigma_c: troncon.sigma_c, w_s: troncon.w_s, b_ext: troncon.b_ext }
      : undefined;

  const flux = fluxDansLesCordons({
    assemblage,
    N_Ed,
    H_Ed: effort.H_Ed,
    f_y_platine,
    f_y_ame,
    ame: { S_f: pourFlux.S_f, I: pourFlux.I },
    appuiContinu,
  });
  const pleine = gorgePleineResistance({
    t_w: plats.t_w,
    f_y: f_y_ame,
    f_u,
    beta_w,
    gamma_M0: profil.gamma_M0,
    gamma_M2: profil.gamma_M2,
  });
  const soudures = verifierSoudures(flux, soudure.a, { f_u, beta_w, gamma_M2: profil.gamma_M2 }, pleine);

  const ames = verifierAmes(
    assemblage,
    N_Ed,
    part,
    materiau.nuance,
    profil,
    appuiContinu === undefined ? undefined : { sigma_c: appuiContinu.sigma_c, w_s: appuiContinu.w_s },
  );

  const interaction =
    schema === 'appui-extremites'
      ? interactionPlatine(
          ames.flexion.sigma_platine,
          -ames.flexion.sigma_pied,
          flux.m_Ed,
          platine.t,
          f_y_platine,
          profil.gamma_M0,
        )
      : null;

  const epaisseur = verifierArrachement({
    t: platine.t,
    a: soudure.a,
    cordonDAngle: true,
    conditions: d.conditionsSoudage ?? CONDITIONS_PAR_DEFAUT,
    qualite: materiau.qualiteZ,
  });

  let service: ResultatService | null = null;
  if (actions.P_blocage !== undefined) {
    if (schema === 'appui-continu') {
      if (troncon === null) throw new Error('L appui continu exige un appui sur beton.');
      service = verifierService({
        schema,
        P_blocage: actions.P_blocage,
        A_eff: troncon.A_eff,
        c: troncon.c,
        t: platine.t,
        f_y: f_y_platine,
        E: profil.E,
        delta_lim: d.delta_lim,
      });
    } else {
      const s = ames.section;
      service = verifierService({
        schema,
        P_blocage: actions.P_blocage,
        part,
        L: plats.L ?? Number.NaN,
        I: s.I,
        v_max: Math.max(s.z_G, platine.t + plats.h_w - s.z_G),
        f_y_poutre: Math.min(f_y_platine, f_y_ame),
        e: plats.e,
        w: resPlatine.flexion?.w ?? Math.min(platine.h, plats.L_w),
        d_0: platine.d_0,
        t: platine.t,
        f_y: f_y_platine,
        E: profil.E,
        delta_lim: d.delta_lim,
      });
    }
  }

  const dispositions = verifierDispositions(REGLES_CHAISE, { assemblage, materiau });

  const liste = tableauDesTaux({ soudures, platine: resPlatine, interaction, ames, epaisseur, service, appuiType: appui.type, schema });
  const tries = trierTaux(liste);
  const max = gouvernant(tries, 'resistance');

  const resistanceOk = max === null || max.valeur <= 1;
  const constats: ResultatAssemblage['constats'] = {
    resistance: {
      ok: resistanceOk,
      motif:
        max === null
          ? 'aucun mecanisme de resistance applicable'
          : `${resistanceOk ? 'resistance suffisante' : 'resistance insuffisante'} : mecanisme le plus sollicite ` +
            `« ${max.libelle} » (${max.clause}), taux ${max.valeur.toFixed(3)}`,
    },
    service:
      service === null
        ? null
        : {
            ok: service.conforme,
            motif: service.conforme
              ? 'la platine reste elastique au blocage' +
                (service.tauxDeformation === null ? '' : ' et sa fleche sous la limite fixee')
              : service.tauxElastique > 1
                ? `la platine plastifie au blocage (taux elastique ${service.tauxElastique.toFixed(3)}) : ` +
                  'sa deformation n est pas negligeable au sens du TA 2020'
                : `fleche au blocage ${service.delta.toFixed(3)} mm au-dela de la limite fixee`,
          },
    dispositions: {
      ok: dispositions.ok,
      motif: dispositions.ok
        ? 'aucune disposition bloquante n est enfreinte'
        : `${dispositions.violations.length} disposition(s) enfreinte(s) : ${dispositions.violations.join(' ; ')}`,
    },
  };

  let verdict: Verdict = 'conforme';
  if (!constats.resistance.ok) verdict = 'non-conforme-resistance';
  else if (constats.service !== null && !constats.service.ok) verdict = 'non-conforme-service';
  else if (!constats.dispositions.ok) verdict = 'non-conforme-dispositions';

  const motif =
    verdict === 'conforme'
      ? `Conforme : ${constats.resistance.motif}.` +
        (constats.service === null ? ' Service non examine (traction de blocage non saisie).' : '')
      : verdict === 'non-conforme-resistance'
        ? `Non conforme en resistance : ${constats.resistance.motif}.`
        : verdict === 'non-conforme-service'
          ? `Non conforme en service : ${constats.service?.motif ?? ''}.`
          : `Non conforme aux dispositions constructives : ${constats.dispositions.motif}.`;

  return {
    verdict,
    motif,
    constats,
    origineEffort: effort.origine,
    N_Ed,
    effort,
    f_y_platine,
    f_y_ame,
    f_u,
    beta_w,
    taux: tries,
    soudures,
    platine: resPlatine,
    interaction,
    ames,
    epaisseur,
    service,
    dispositions,
    mecanismeGouvernant: max?.id ?? 'aucun',
  };
}

interface Morceaux {
  soudures: ResultatSoudures;
  platine: ResultatPlatine;
  interaction: ResultatInteraction | null;
  ames: ResultatAmes;
  epaisseur: ResultatArrachement;
  service: ResultatService | null;
  appuiType: Assemblage['appui']['type'];
  schema: Assemblage['schema'];
}

/** Un taux par mecanisme, applicable ou non. */
function tableauDesTaux(m: Morceaux): Taux[] {
  const l: Taux[] = [];
  const continu = m.schema === 'appui-continu';

  l.push(taux('soudure', 'EN 1993-1-8 §4.5.3.2', `cordons d angle, ${m.soudures.gouvernant.cas.libelle}`, m.soudures.taux));

  const tr = m.platine.troncon;
  l.push(
    tr === null
      ? sansObjet('appui-beton', 'EN 1993-1-8 §6.2.5', 'appui de la platine sur le beton', SUR_LIERNE)
      : taux('appui-beton', 'EN 1993-1-8 §6.2.5', 'appui de la platine sur le beton (troncon en te)', tr.taux),
  );
  l.push(taux('poinconnement-platine', 'EN 1993-1-1 §6.2.6', 'cisaillement de la platine autour de la couronne', m.platine.poinconnement.taux));

  const sn = m.platine.sectionNette;
  l.push(
    sn === null
      ? sansObjet('section-nette', 'EN 1993-1-1 §6.2.5', 'flexion de la platine au droit du percage', `${APPUI_CONTINU} ; sa flexion est couverte par le troncon en te`)
      : taux('section-nette', 'EN 1993-1-1 §6.2.5', 'flexion de la platine au droit du percage (N e / 6)', sn.taux),
  );
  const ci = m.platine.cisaillement;
  l.push(
    ci === null
      ? sansObjet('cisaillement-platine', 'EN 1993-1-1 §6.2.6', 'cisaillement de la platine au droit des ames', APPUI_CONTINU)
      : taux('cisaillement-platine', 'EN 1993-1-1 §6.2.6', 'cisaillement de la platine au droit des ames', ci.taux),
  );
  l.push(
    m.interaction === null
      ? sansObjet('interaction-platine', 'EN 1993-1-1 §6.2.1(5)', 'platine : poutre et flexion locale combinees', APPUI_CONTINU)
      : taux('interaction-platine', 'EN 1993-1-1 §6.2.1(5)', 'platine : poutre et flexion locale combinees', m.interaction.taux),
  );

  const f = m.ames.flexion;
  const libellePoutre = continu ? 'poutre en te sous la pression collectee' : 'poutre de portee L';
  l.push(taux('flexion-ame', 'EN 1993-1-1 §6.2.5 et §6.2.8', `flexion de la ${libellePoutre}`, f.tauxFlexion));
  l.push(taux('tranchant-ame', 'EN 1993-1-1 §6.2.6', `effort tranchant de la ${libellePoutre}`, f.tauxTranchant));
  l.push(taux('torsion-raidisseur', 'EN 1993-1-5 §9.2.1(8)', 'voilement par torsion de l ame (chant libre comprime)', m.ames.torsion.taux));
  l.push(taux('voilement-cisaillement', 'EN 1993-1-5 §5.1(2)', 'elancement de l ame au voilement par cisaillement', m.ames.voilementCisaillement.taux));

  const li = m.ames.lierne;
  l.push(
    li === null
      ? sansObjet(
          'charge-transversale-lierne',
          'EN 1993-1-5 §6',
          'charge transversale sur l ame de la lierne',
          m.appuiType === 'beton' ? 'appui sur beton' : APPUI_CONTINU,
        )
      : taux('charge-transversale-lierne', 'EN 1993-1-5 §6', 'charge transversale sur l ame de la lierne', li.gouvernant.taux),
  );
  l.push(taux('arrachement-lamellaire', 'EN 1993-1-10 §3.2', `arrachement lamellaire, Z_Ed = ${m.epaisseur.Z_Ed}`, m.epaisseur.taux));

  if (m.service === null) {
    l.push(sansObjet('service-elastique', 'CFMS TA 2020', 'platine elastique au blocage', 'traction de blocage non saisie', 'service'));
  } else {
    l.push(taux('service-elastique', 'CFMS TA 2020', 'platine elastique au blocage', m.service.tauxElastique, 'service'));
    l.push(
      m.service.tauxDeformation === null
        ? sansObjet('service-fleche', 'CFMS TA 2020', 'fleche au blocage', 'aucune limite de fleche fixee', 'service')
        : taux('service-fleche', 'CFMS TA 2020', 'fleche au blocage', m.service.tauxDeformation, 'service'),
    );
  }
  return l;
}
