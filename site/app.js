// Page du tableau de bord : récupère data.json et affiche les relevés.
// Le DOM est construit avec textContent uniquement (jamais innerHTML).
import {
  ageLisible, estPerime, libelleStatut,
  formaterNombre, variation, pourcentageQuota, alertesFalling, pointsCourbe,
  lienSur, lienVideo, lienAnalytiquesVideo, lienAnalytiquesChaine, lienStudio, lienChaine, lienDirect,
  actionAffichee, attenteTerminee, messageApresConfirmation,
  lienPlateforme, delaiAvant, classerCalendrier, libelleOrdre, trierAlertes,
  jourParis, formaterMontant, construireAgenda, groupesDeTaches, tuilesAccueil, presenterConcours, pileDeConcours, estRappelDeDecision, nomCourtProduit, abreger, lienGumroad, lienTiktok,
  rangerEnOnglets, pastilleOnglet, rapprocherProduits, depotDepuisLien, cleGithubValide, messageErreurGithub, choisirCleGithub,
} from "./lib.js";
import { deriverCle, dechiffrer } from "./chiffre.js";

const SVG = "http://www.w3.org/2000/svg";
const HEURES_STATISTIQUES_PERIMEES = 36;

const NOMS_SOURCES = { "local-pc": "Relevé du PC" };
const STATUTS_CONNUS = ["ok", "introuvable", "pas-de-git", "aucun-commit", "erreur"];

const message = document.getElementById("message");
const contenu = document.getElementById("contenu");
const generation = document.getElementById("generation");
// Page publiée en ligne (GitHub Pages) : pas de serveur privé, les données sont dans un fichier chiffré que le mot de passe ouvre.
const EN_LIGNE = document.body.dataset.mode === "en-ligne";

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function afficherMessage(texte, type) {
  message.textContent = texte;
  message.dataset.type = type;
}

function dateLocale(iso) {
  const date = typeof iso === "string" ? new Date(iso) : new Date(NaN);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

// « 1 vue », « 12 vues » ; « ? » si ce n'est pas un nombre exploitable.
function compter(n, singulier, pluriel) {
  const texte = formaterNombre(n);
  return texte === "?" ? "?" : `${texte} ${n === 1 ? singulier : pluriel}`;
}

function ligneDetail(liste, nom, valeur) {
  liste.append(el("dt", "", nom), el("dd", "", valeur));
}

function carteProjet(projet) {
  const statut = STATUTS_CONNUS.includes(projet.statut) ? projet.statut : "inconnu";
  const carte = el("article", "carte");
  carte.append(el("h3", "", projet.nom), el("span", `statut statut-${statut}`, libelleStatut(projet.statut)));

  if (projet.statut === "ok") {
    const details = projet.details ?? {};
    const commit = details.dernier_commit ?? {};
    const liste = el("dl");
    ligneDetail(liste, "Branche", details.branche ?? "?");
    ligneDetail(liste, "Dernier commit", commit.sujet ?? "?");
    ligneDetail(liste, "Date du commit", commit.date ? dateLocale(commit.date) : "?");
    ligneDetail(liste, "Modifications non validées", String(details.modifications_non_validees ?? "?"));
    carte.append(liste);
  } else if (projet.message) {
    carte.append(el("p", "discret", projet.message));
  }
  return carte;
}

// ---------- Carte Falling Pickaxe (les données sont déjà nettoyées côté PC ; on ne leur fait pas confiance pour autant) ----------

const objet = (valeur) => (valeur && typeof valeur === "object" && !Array.isArray(valeur) ? valeur : {});
const liste = (valeur) => (Array.isArray(valeur) ? valeur.filter((x) => x && typeof x === "object") : []);
const titreSur = (valeur) => (typeof valeur === "string" && valeur.trim() ? valeur : "(sans titre)");

function lien(texte, url, classe = "lien") {
  if (!url) return null;
  const a = el("a", classe, texte);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function groupeDeLiens(classe, ...liens) {
  const groupe = el("div", classe);
  groupe.append(...liens.filter(Boolean));
  return groupe;
}

// Section repliable native (<details>) : les longues listes ne s'ouvrent qu'à la demande, surtout sur téléphone.
function sectionFp(titre, ouverte, ...enfants) {
  const section = document.createElement("details");
  section.className = "fp-section";
  section.open = ouverte;
  section.append(el("summary", "", titre), ...enfants);
  return section;
}

function ligneFp(titre, meta, liens) {
  const ligne = el("li", "fp-ligne");
  ligne.append(el("span", "fp-titre", titreSur(titre)), el("span", "discret fp-meta", meta));
  if (liens) ligne.append(liens);
  return ligne;
}

function listeFp(lignes, vide) {
  if (lignes.length === 0) return el("p", "discret", vide);
  const ul = el("ul", "fp-liste");
  ul.append(...lignes);
  return ul;
}

function ligneVideo(v) {
  const meta = [v.type === "compilation" ? "Compilation" : "Short"];
  const date = v.publie_pour || v.quand;
  if (date) meta.push(dateLocale(date));
  if (typeof v.duree === "number") meta.push(`${formaterNombre(Math.round(v.duree))} s`);
  return ligneFp(
    v.titre, meta.join(" · "),
    groupeDeLiens("fp-liens", lien("Voir", lienVideo(v.id)), lien("Analytiques", lienAnalytiquesVideo(v.id))),
  );
}

function courbeSvg(valeurs, libelle) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 -4 300 64");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "courbe");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", libelle);
  const points = pointsCourbe(valeurs, 300, 56);
  if (points) {
    const ligne = document.createElementNS(SVG, "polyline");
    ligne.setAttribute("points", points);
    svg.append(ligne);
  }
  return svg;
}

function blocCourbe(titre, courbe, cle) {
  const valeurs = courbe.map((p) => p[cle]);
  const bloc = el("div", "fp-courbe");
  bloc.append(el("div", "fp-courbe-titre", titre), courbeSvg(valeurs, `${titre}, ${courbe.length} jours`));
  const premier = courbe[0];
  const dernier = courbe[courbe.length - 1];
  const jour = (point) => (typeof point.date === "string" ? point.date : "?");
  const resume = courbe.length >= 2
    ? `${formaterNombre(premier[cle])} → ${formaterNombre(dernier[cle])} (du ${jour(premier)} au ${jour(dernier)})`
    : "Pas assez de points pour une courbe.";
  bloc.append(el("div", "discret fp-courbe-resume", resume));
  return bloc;
}

// ---------- Commandes du live (étape C) : visibles seulement si le serveur privé les propose ----------

const DELAI_SUIVI_MS = 3000;
let dernierResultat = null; // { texte, reussi } : montré une fois, après le rafraîchissement de la carte

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function lireEtatActions() {
  if (EN_LIGNE) return null;
  try {
    const reponse = await fetch("api/actions/etat", { cache: "no-store" });
    return reponse.ok ? await reponse.json() : null;
  } catch {
    return null;
  }
}

async function poster(chemin, corps) {
  try {
    const reponse = await fetch(chemin, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tableau": "1" },
      body: JSON.stringify(corps),
      cache: "no-store",
    });
    let json = null;
    try {
      json = await reponse.json();
    } catch {
      // corps vide ou qui n'est pas du JSON : le statut HTTP suffit
    }
    return { ok: reponse.ok, json };
  } catch {
    return { ok: false, json: { erreur: "Le serveur ne répond pas." } };
  }
}

function bouton(texte, classe, auClic) {
  const b = el("button", `bouton ${classe}`, texte);
  b.type = "button";
  b.addEventListener("click", auClic);
  return b;
}

function ecrireMessage(noeud, texte, type) {
  noeud.textContent = texte;
  noeud.dataset.type = type;
}

function dessinerCommandes(zone, etat, actions) {
  const live = actions.find((a) => typeof a.live_en_cours === "boolean");
  const action = actionAffichee(live ? live.live_en_cours : null, actions);
  const simulation = etat.mode === "simulation";

  const entete = el("div", "fp-entete");
  entete.append(
    el("strong", "", "Commandes"),
    el("span", simulation ? "badge-simulation" : "badge-reel", simulation ? "Simulation : rien n'est exécuté" : "Mode réel"),
  );
  const message = el("p", "cmd-message");
  message.setAttribute("role", "status");
  if (dernierResultat) {
    ecrireMessage(message, dernierResultat.texte, dernierResultat.reussi ? "ok" : "erreur");
    dernierResultat = null;
  }
  const emplacement = el("div", "cmd-emplacement");
  zone.replaceChildren(entete, message, emplacement);

  if (!action) {
    emplacement.append(el("p", "discret", "L'état du live est inconnu : commandes désactivées."));
    return;
  }

  const occupe = etat.en_cours != null;
  const attendre = Number(etat.attendre) > 0;
  const principal = bouton(action.libelle, action.id.endsWith(".couper") ? "bouton-danger" : "bouton-principal", demander);
  principal.disabled = !action.disponible || occupe || attendre;
  emplacement.append(principal);
  if (!action.disponible && action.raison) emplacement.append(el("p", "discret", String(action.raison)));
  else if (occupe) emplacement.append(el("p", "discret", "Une action est déjà en cours."));
  else if (attendre) emplacement.append(el("p", "discret", `Patientez ${Math.ceil(Number(etat.attendre))} s avant une nouvelle action.`));

  async function rafraichir(texte, reussi) {
    if (texte) dernierResultat = { texte, reussi };
    const maj = await lireEtatActions();
    const liste = maj && Array.isArray(maj.actions) ? maj.actions.filter((a) => a && a.projet === action.projet) : [];
    if (liste.length > 0) dessinerCommandes(zone, maj, liste);
  }

  async function demander() {
    principal.disabled = true;
    const reponse = await poster("api/actions/demander", { action: action.id });
    if (!reponse.ok) {
      const texte = reponse.json && reponse.json.erreur ? reponse.json.erreur : "Commande impossible.";
      await rafraichir(texte, false);
      return;
    }
    confirmation(reponse.json);
  }

  function confirmation(demande) {
    let restant = Number(demande.expire_dans) > 0 ? Number(demande.expire_dans) : 30;
    const compte = el("p", "discret cmd-compte");
    const panneau = el("div", "cmd-confirmation");
    const fermer = () => {
      clearInterval(minuteur);
      panneau.remove();
    };
    const minuteur = setInterval(() => {
      restant -= 1;
      if (restant <= 0) {
        fermer();
        rafraichir("Confirmation expirée : recommencez.", false);
      } else {
        compte.textContent = `Expire dans ${restant} s`;
      }
    }, 1000);
    compte.textContent = `Expire dans ${restant} s`;

    const confirmer = bouton("Confirmer", "bouton-danger", async () => {
      fermer();
      await executer(demande.jeton);
    });
    const annuler = bouton("Annuler", "bouton-secondaire", () => {
      fermer();
      rafraichir("Annulé.", true);
    });
    panneau.setAttribute("role", "group");
    panneau.setAttribute("aria-label", "Confirmation");
    panneau.append(
      el("p", "cmd-titre", `${String(demande.libelle ?? action.libelle)} ?`),
      el("p", "cmd-avertissement", String(demande.avertissement ?? "")),
      compte,
      groupeDeLiens("cmd-actions", confirmer, annuler),
    );
    emplacement.append(panneau);
  }

  async function executer(jeton) {
    const reponse = await poster("api/actions/confirmer", { jeton });
    if (!reponse.ok) {
      const texte = reponse.json && reponse.json.erreur ? reponse.json.erreur : "Commande impossible.";
      await rafraichir(texte, false);
      return;
    }
    const statut = reponse.json ? reponse.json.statut : null;
    if (statut !== "declenchee") {
      await rafraichir(messageApresConfirmation(statut), statut === "simulee");
      return;
    }
    ecrireMessage(message, messageApresConfirmation(statut), "info");
    const debut = Date.now();
    for (;;) {
      await pause(DELAI_SUIVI_MS);
      const maj = await lireEtatActions();
      const suivie = maj && Array.isArray(maj.actions) ? maj.actions.find((a) => a && a.id === action.id) : null;
      const verdict = attenteTerminee(action.id, suivie ? suivie.live_en_cours : null, Date.now() - debut);
      ecrireMessage(message, verdict.message, verdict.fini ? (verdict.reussi ? "ok" : "erreur") : "info");
      if (verdict.fini) {
        dernierResultat = { texte: verdict.message, reussi: verdict.reussi };
        await charger(); // redessine toute la carte : le voyant du direct suit l'état réel
        return;
      }
    }
  }
}

async function initialiserCommandes(zone, projetId) {
  const etat = await lireEtatActions();
  if (!etat || !Array.isArray(etat.actions)) return; // page publique ou serveur sans commandes : rien à afficher
  const actions = etat.actions.filter((a) => a && typeof a === "object" && a.projet === projetId);
  if (actions.length === 0) return;
  zone.hidden = false;
  dessinerCommandes(zone, etat, actions);
}

function carteFallingPickaxe(projet, maintenant) {
  const d = objet(projet.details);
  const live = objet(d.live);
  const chaine = objet(d.chaine);
  const quota = objet(d.quota);
  const chaineId = objet(d.liens).chaine_id;
  const courbe = liste(d.courbe);
  const videos = liste(d.videos);
  const carte = el("article", "carte carte-large");

  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", String(projet.nom ?? "Falling Pickaxe")));
  entete.append(live.en_cours ? el("span", "badge-live", "● En direct") : el("span", "badge-arret", "Direct arrêté"));
  const age = live.en_cours && live.depuis ? ageLisible(live.depuis, maintenant) : "date inconnue";
  if (live.en_cours && age !== "date inconnue") entete.append(el("span", "discret", `démarré ${age}`));
  carte.append(entete);

  // En direct : l'adresse stable de la chaîne ; sinon (ou sans identifiant de chaîne) le direct du dernier bilan,
  // dont l'adresse peut dater (elle n'est mise à jour que le soir). Les autres liens se rangent dans une section repliée.
  const lienDuLive = live.en_cours ? lien("Ouvrir le direct", lienDirect(chaineId), "lien lien-principal") : null;
  const lienPrincipal = lienDuLive || lien("Direct du dernier bilan", lienSur(live.url));
  if (lienPrincipal) carte.append(groupeDeLiens("fp-acces", lienPrincipal));
  const liensChaine = groupeDeLiens(
    "fp-acces",
    lien("Salle de contrôle du direct", lienStudio(chaineId, "live")),
    lien("Analytiques de la chaîne", lienAnalytiquesChaine(chaineId)),
    lien("Contenu (Studio)", lienStudio(chaineId, "content")),
    lien("Page de la chaîne", lienChaine(chaineId)),
  );

  const alertesLive = alertesFalling(d, maintenant);
  for (const alerte of alertesLive.slice(0, 2)) carte.append(el("p", `alerte alerte-${alerte.niveau}`, alerte.texte));
  if (alertesLive.length > 2) {
    carte.append(sectionFp(`Voir les ${alertesLive.length - 2} autres alertes`, false, ...alertesLive.slice(2).map((a) => el("p", `alerte alerte-${a.niveau}`, a.texte))));
  }

  const zoneCommandes = el("section", "fp-commandes");
  zoneCommandes.hidden = true; // montrée seulement si le serveur privé propose des commandes
  carte.append(zoneCommandes);
  initialiserCommandes(zoneCommandes, projet.id).catch(() => {});

  const chiffres = el("div", "grosses-tuiles");
  const depuisBilan = (valeur, precedent) => {
    const v = variation(valeur, precedent);
    return v.sens === "inconnu" ? "" : `${v.texte} depuis le bilan précédent`;
  };
  chiffres.append(
    grosseTuile({ ton: "success", valeur: formaterNombre(chaine.abonnes), libelle: "abonnés", detail: depuisBilan(chaine.abonnes, chaine.abonnes_veille) }, "👥"),
    grosseTuile({ ton: "accent", valeur: formaterNombre(chaine.vues), libelle: "vues", detail: depuisBilan(chaine.vues, chaine.vues_veille) }, "👀"),
  );
  carte.append(chiffres, el("p", "discret", `${formaterNombre(chaine.videos)} vidéos sur la chaîne`));
  const ages = el("p", "discret fp-ages");
  const majAbonnes = chaine.maj_abonnes ? ageLisible(chaine.maj_abonnes, maintenant) : "date inconnue";
  const majChiffres = typeof chaine.maj_chiffres === "string" && !Number.isNaN(Date.parse(chaine.maj_chiffres))
    ? `${dateLocale(chaine.maj_chiffres)} (${ageLisible(chaine.maj_chiffres, maintenant)})`
    : "date inconnue";
  ages.append(`Abonnés mis à jour : ${majAbonnes} · Autres chiffres : ${majChiffres}`);
  if (estPerime(chaine.maj_chiffres, maintenant, HEURES_STATISTIQUES_PERIMEES)) {
    ages.append(" ", el("span", "badge-perime", "Périmé"));
  }
  const courbes = el("div", "fp-courbes");
  courbes.append(blocCourbe("Abonnés", courbe, "abonnes"), blocCourbe("Vues", courbe, "vues"));
  if (estPerime(chaine.maj_chiffres, maintenant, HEURES_STATISTIQUES_PERIMEES)) {
    carte.append(el("p", "alerte alerte-avertissement", `Les chiffres de la chaîne datent de plus de ${HEURES_STATISTIQUES_PERIMEES} h : ne vous y fiez pas.`));
  }

  const aVenir = videos
    .filter((v) => v.programme === true && Date.parse(v.publie_pour) > maintenant.getTime())
    .sort((a, b) => Date.parse(a.publie_pour) - Date.parse(b.publie_pour));
  const recentes = videos.filter((v) => !aVenir.includes(v));
  carte.append(
    sectionFp(
      `Vidéos à venir (${aVenir.length})`, true, listeFp(aVenir.slice(0, 3).map(ligneVideo), "Aucune vidéo programmée."),
      ...(aVenir.length > 3 ? [sectionFp(`Voir les ${aVenir.length - 3} autres`, false, listeFp(aVenir.slice(3).map(ligneVideo), ""))] : []),
    ),
    sectionFp("Évolution et mises à jour", false, courbes, ages),
    sectionFp(`Vidéos récentes (${recentes.length})`, false, listeFp(recentes.map(ligneVideo), "Aucune vidéo récente.")),
    sectionFp(`Shorts : résultats (${liste(d.shorts).length})`, false, listeFp(
      liste(d.shorts).map((s) => ligneFp(
        s.titre,
        [compter(s.vues, "vue", "vues"), compter(s.likes, "like", "likes"), s.montage, s.date].filter((x) => typeof x === "string" && x !== "").join(" · "),
      )),
      "Aucun Short relevé.",
    )),
    sectionFp(`Derniers directs (${liste(d.directs).length})`, false, listeFp(
      liste(d.directs).map((x) => ligneFp(
        x.titre,
        [x.date, typeof x.heures === "number" ? `${formaterNombre(Math.round(x.heures * 10) / 10)} h` : null,
          compter(x.vues, "vue", "vues"), compter(x.likes, "like", "likes")].filter((p) => typeof p === "string" && p !== "").join(" · "),
      )),
      "Aucun direct relevé.",
    )),
  );

  const pct = pourcentageQuota(quota.unites, quota.limite);
  const barre = document.createElement("progress");
  barre.max = 100;
  barre.value = pct;
  barre.setAttribute("aria-label", "Quota YouTube utilisé aujourd'hui");
  carte.append(sectionFp(
    "Quota YouTube",
    pct >= 80, // ouvert seulement quand il devient serré
    barre,
    el("p", "discret", `${formaterNombre(quota.unites)} / ${formaterNombre(quota.limite)} unités (${pct} %) — jour ${typeof quota.jour === "string" ? quota.jour : "?"}`),
  ));
  carte.append(sectionFp("Liens de la chaîne", false, liensChaine));
  return carte;
}

// ---------- Concours Gratuits FR et Produits numériques (étape D) ----------

const DELAI_RAFRAICHISSEMENT_MS = 120000;
const FORMAT_RENDEZ_VOUS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});
const FORMAT_HEURE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const ordresEnvoyes = new Map(); // code de carte -> "ok" | "no" : ordres envoyés depuis cette page (le dépôt ne les montre que plus tard)
let rapprochement = { parLocal: {}, sansDossier: [], disponible: false }; // produits locaux rapprochés de la boutique Gumroad (calculé à chaque affichage)
let confirmationsOuvertes = 0; // tant qu'une confirmation est ouverte, la page ne se rafraîchit pas toute seule
let decisionsDisponibles = false; // vrai seulement sur le tableau privé (routes /api/concours/*)
let prochainPassageBot = null; // ISO du prochain passage du bot, pour dire quand un ordre sera appliqué

function textePassage() {
  if (typeof prochainPassageBot !== "string" || Number.isNaN(Date.parse(prochainPassageBot))) return "";
  return ` (${delaiAvant(prochainPassageBot, new Date())}, vers ${heureParis(prochainPassageBot)}, heure de Paris)`;
}

async function lireEtatDecisions() {
  if (EN_LIGNE) return null;
  try {
    const reponse = await fetch("api/concours/etat", { cache: "no-store" });
    return reponse.ok ? await reponse.json() : null;
  } catch {
    return null;
  }
}

function blocAlertes(alertes) {
  const zone = el("div", "cc-alertes");
  for (const a of trierAlertes(alertes)) zone.append(el("p", `alerte alerte-${a.niveau}`, a.texte));
  return zone;
}

// Les deux plus graves alertes ; les suivantes derrière « Voir les n autres ».
function blocAlertesCourt(alertes, max = 2) {
  const triees = trierAlertes(alertes);
  const zone = blocAlertes(triees.slice(0, max));
  if (triees.length > max) zone.append(sectionFp(`Voir les ${triees.length - max} autres`, false, blocAlertes(triees.slice(max, 25))));
  return zone;
}

const TONS = new Set(["accent", "success", "warning", "danger", "neutre"]);

// Une grosse tuile colorée : un gros chiffre, ce qu'il veut dire, un détail. Elle ouvre l'onglet `cible` quand il y en a un.
function grosseTuile(t, icone) {
  const cliquable = typeof t.cible === "string" && t.cible !== "";
  const noeud = el(cliquable ? "button" : "div", `grosse-tuile ton-${TONS.has(t.ton) ? t.ton : "neutre"}`);
  if (cliquable) {
    noeud.type = "button";
    noeud.addEventListener("click", () => allerVersOnglet(t.cible));
  }
  if (icone) noeud.append(el("span", "gt-icone", icone));
  noeud.append(el("span", "gt-valeur", String(t.valeur)), el("span", "gt-libelle", String(t.libelle)));
  if (t.detail) noeud.append(el("span", "gt-detail", String(t.detail)));
  return noeud;
}

function tuileTexte(nom, valeur, precision) {
  const t = el("div", "tuile");
  t.append(el("span", "tuile-valeur tuile-valeur-texte", String(valeur)), el("span", "tuile-nom", nom));
  if (precision) t.append(el("span", "discret variation", String(precision)));
  return t;
}

function tuileNombre(nom, valeur, precision) {
  const t = el("div", "tuile");
  t.append(el("span", "tuile-valeur", formaterNombre(valeur)), el("span", "tuile-nom", nom));
  if (precision) t.append(el("span", "discret variation", String(precision)));
  return t;
}

function heureParis(iso) {
  return typeof iso === "string" && !Number.isNaN(Date.parse(iso)) ? FORMAT_HEURE.format(new Date(iso)) : "?";
}

function rendezVous(e) {
  if (typeof e.quand === "string" && !Number.isNaN(Date.parse(e.quand))) return FORMAT_RENDEZ_VOUS.format(new Date(e.quand));
  if (typeof e.jour === "string" && e.jour.length >= 10) return `${e.jour.slice(8, 10)}/${e.jour.slice(5, 7)} (dans la journée)`;
  return "date inconnue";
}

// ---------- Boutons ✅ / ❌ de la page en ligne : l'ordre part à GitHub (boîte aux ordres), le bot le lit à son prochain passage ----------

let depotConcours = null; // « propriétaire/dépôt » du bot, pris dans les données chiffrées

const enTetesGithub = (jeton) => ({ Authorization: `Bearer ${jeton}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });

function demandeEnLigne(c, action) {
  const verbe = action === "ok" ? "Publier" : "Refuser";
  return {
    jeton: null, expire_dans: 30, libelle: `${verbe} « ${String(c.titre ?? "(sans titre)").slice(0, 80)} »`,
    avertissement: action === "ok"
      ? "L'ordre part à GitHub : le bot publiera ce concours sur la chaîne Telegram à son prochain passage."
      : "L'ordre part à GitHub : le bot oubliera ce concours pour de bon à son prochain passage.",
  };
}

// { ok, json } comme la réponse du serveur privé, pour que la même interface serve aux deux.
async function envoyerOrdreGithub(action, code) {
  const jeton = lireJetonGithub();
  if (!jeton) return { ok: false, json: { erreur: "Aucune clé GitHub n'est enregistrée sur cet appareil." } };
  if (!depotConcours) return { ok: false, json: { erreur: "Le dépôt du bot est inconnu : actualise la page." } };
  if ((action !== "ok" && action !== "no") || !/^[0-9a-f]{10}$/.test(code)) return { ok: false, json: { erreur: "Décision invalide." } };
  const base = `https://api.github.com/repos/${depotConcours}/issues`;
  try {
    // Pas de doublon : un ordre déjà en attente pour cette carte est refusé.
    const liste = await fetch(`${base}?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (!liste.ok) return { ok: false, json: { erreur: messageErreurGithub(liste.status) } };
    const tickets = await liste.json();
    if (Array.isArray(tickets) && tickets.some((t) => t && (t.title === `ok_${code}` || t.title === `no_${code}`))) {
      return { ok: false, json: { erreur: "Un ordre est déjà en attente pour cette carte : le bot l'applique à son prochain passage." } };
    }
    const reponse = await fetch(base, {
      method: "POST", headers: { ...enTetesGithub(jeton), "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${action}_${code}`, body: "Ordre donné depuis la page en ligne du tableau de bord." }),
    });
    if (reponse.status === 201) return { ok: true, json: { statut: "envoye", action, code } };
    return { ok: false, json: { erreur: messageErreurGithub(reponse.status) } };
  } catch {
    return { ok: false, json: { erreur: "GitHub est injoignable : réessaie dans un moment." } };
  }
}

// Les ordres déjà donnés et pas encore appliqués (tickets ouverts) : les cartes concernées l'indiquent, même après un rechargement.
async function lireOrdresEnAttenteGithub() {
  const jeton = lireJetonGithub();
  if (!jeton || !depotConcours) return;
  try {
    const reponse = await fetch(`https://api.github.com/repos/${depotConcours}/issues?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (!reponse.ok) return;
    const tickets = await reponse.json();
    for (const t of Array.isArray(tickets) ? tickets : []) {
      const trouve = t && typeof t.title === "string" ? /^(ok|no)_([0-9a-f]{10})$/.exec(t.title) : null;
      if (trouve) ordresEnvoyes.set(trouve[2], trouve[1]);
    }
  } catch {
    // sans cette lecture, les boutons marchent quand même (le doublon est refusé à l'envoi)
  }
}

// Où mettre la clé GitHub : un champ, enregistré dans ce navigateur seulement.
function sectionCleGithub() {
  const choix = choixCleGithub();
  if (choix && choix.origine === "donnees") {
    return sectionFp("Boutons ✅ / ❌ activés (clé fournie par le tableau)", false, el("p", "discret",
      "La clé GitHub des ordres arrive avec les données chiffrées : rien à saisir sur cet appareil. "
      + "Pour la retirer, supprime son fichier sur le PC (cle_github_ordres.txt) et révoque-la sur github.com."));
  }
  const active = Boolean(lireJetonGithub());
  const retour = el("p", "cmd-message");
  retour.setAttribute("role", "status");
  const champ = el("input");
  champ.type = "password";
  champ.name = "cle-github";
  champ.autocomplete = "off";
  champ.placeholder = "github_pat_…";
  champ.setAttribute("aria-label", "Clé GitHub");
  const enregistrer = bouton("Enregistrer la clé", "bouton-principal", async () => {
    const saisie = champ.value.trim();
    if (!cleGithubValide(saisie)) {
      ecrireMessage(retour, "Ce n'est pas une clé « fine-grained » (elle commence par github_pat_). Les clés classiques sont refusées : trop de pouvoirs.", "erreur");
      return;
    }
    ecrireStockage(CLE_JETON_GITHUB, saisie);
    champ.value = "";
    await charger();
  });
  const oublier = bouton("Oublier la clé", "bouton-secondaire", async () => {
    oublierStockage(CLE_JETON_GITHUB);
    ordresEnvoyes.clear();
    await charger();
  });
  const explication = el("p", "discret",
    "Sur github.com, connecté au compte qui possède le bot : Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token. "
    + "Choisis le seul dépôt du bot, et la seule permission « Issues » en lecture et écriture. Copie la clé ici : elle reste dans ce navigateur, "
    + "ne sert qu'à envoyer tes ✅ / ❌, et ne peut ni modifier le bot ni lire ses clés secrètes.");
  return sectionFp(
    active ? "Boutons ✅ / ❌ activés sur cet appareil" : "Activer les boutons ✅ / ❌ (clé GitHub)", !active,
    explication, champ, groupeDeLiens("cmd-actions", enregistrer, ...(active ? [oublier] : [])), retour,
  );
}

// ✅ Publier / ❌ Refuser sur une carte du bot : demande, confirmation (jeton de 30 s), puis l'ordre part vers le bot.
// options.grand : gros boutons (pile de concours) ; options.apres(action) : appelé une fois l'ordre envoyé.
function zoneDecision(c, options = {}) {
  const grand = options.grand === true;
  const zone = el("div", "cc-decision");
  const emplacement = el("div", grand ? "cc-boutons cc-boutons-grands" : "cc-boutons");
  const message = el("p", "cmd-message");
  message.setAttribute("role", "status");
  zone.append(emplacement, message);

  function dessiner() {
    emplacement.replaceChildren();
    const ordre = c.ordre === "ok" || c.ordre === "no" ? c.ordre : ordresEnvoyes.get(c.code);
    if (libelleOrdre(ordre)) {
      emplacement.append(el("span", "badge-attention", libelleOrdre(ordre)), el("span", "discret", `Le bot l'applique à son prochain passage${textePassage()}.`));
      return;
    }
    if (c.approuve === true) emplacement.append(el("span", "badge-ok", "Accepté : publication au prochain passage"));
    if (!decisionsDisponibles) return; // page sans commandes : lecture seule
    const publier = c.approuve !== true ? bouton("✅ Publier", grand ? "bouton-grand bouton-publier" : "bouton-principal", () => demander("ok")) : null;
    const refuser = bouton("❌ Refuser", grand ? "bouton-grand bouton-refuser" : "bouton-danger", () => demander("no"));
    emplacement.append(...(grand ? [refuser, publier] : [publier, refuser]).filter(Boolean));
  }

  async function demander(action) {
    emplacement.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    if (EN_LIGNE) {
      confirmation(demandeEnLigne(c, action), action); // pas de serveur : la confirmation se fait ici, l'ordre part à GitHub
      return;
    }
    const reponse = await poster("api/concours/demander", { action, code: c.code });
    if (!reponse.ok) {
      ecrireMessage(message, reponse.json && reponse.json.erreur ? reponse.json.erreur : "Décision impossible.", "erreur");
      dessiner();
      return;
    }
    confirmation(reponse.json, action);
  }

  function confirmation(demande, action) {
    let restant = Number(demande.expire_dans) > 0 ? Number(demande.expire_dans) : 30;
    const compte = el("p", "discret cmd-compte");
    const panneau = el("div", "cmd-confirmation");
    confirmationsOuvertes += 1;
    let ferme = false;
    const fermer = () => {
      if (ferme) return;
      ferme = true;
      confirmationsOuvertes -= 1;
      clearInterval(minuteur);
      panneau.remove();
    };
    const minuteur = setInterval(() => {
      restant -= 1;
      if (restant <= 0) {
        fermer();
        ecrireMessage(message, "Confirmation expirée : recommencez.", "erreur");
        dessiner();
      } else {
        compte.textContent = `Expire dans ${restant} s`;
      }
    }, 1000);
    compte.textContent = `Expire dans ${restant} s`;
    const confirmer = bouton("Confirmer", "bouton-danger", async () => {
      confirmer.disabled = true;
      const reponse = EN_LIGNE ? await envoyerOrdreGithub(action, c.code) : await poster("api/concours/confirmer", { jeton: demande.jeton });
      fermer();
      if (!reponse.ok) {
        ecrireMessage(message, reponse.json && reponse.json.erreur ? reponse.json.erreur : "Décision impossible.", "erreur");
        dessiner();
        return;
      }
      ordresEnvoyes.set(c.code, action);
      ecrireMessage(message, `Ordre envoyé : le bot l'appliquera à son prochain passage${textePassage()}.`, "ok");
      dessiner();
      if (typeof options.apres === "function") options.apres(action);
    });
    const annuler = bouton("Annuler", "bouton-secondaire", () => {
      fermer();
      ecrireMessage(message, "Annulé.", "info");
      dessiner();
    });
    panneau.setAttribute("role", "group");
    panneau.setAttribute("aria-label", "Confirmation");
    panneau.append(
      el("p", "cmd-titre", `${String(demande.libelle ?? "Confirmer")} ?`),
      el("p", "cmd-avertissement", String(demande.avertissement ?? "")),
      compte,
      groupeDeLiens("cmd-actions", confirmer, annuler),
    );
    zone.append(panneau);
  }

  dessiner();
  return zone;
}

const reportesConcours = []; // codes passés « pour plus tard » : renvoyés au bout de la pile (jusqu'au rechargement de la page)
let confirmationPile = null; // texte de la dernière décision envoyée, montré au-dessus du concours suivant

// Les concours à décider, un par un : le lot en grand, deux gros boutons, « Passer » pour y revenir plus tard.
function pileConcours(cartes, maintenant) {
  const zone = el("section", "pile");
  zone.setAttribute("aria-label", "Concours à décider");

  function dessiner() {
    const pile = pileDeConcours(cartes, { maintenant, masques: new Set(ordresEnvoyes.keys()), reportes: reportesConcours });
    const entete = el("div", "pile-entete");
    entete.append(el("h3", "", "À décider"), pile.length > 0 ? el("span", "badge-compteur", `${pile.length} à décider`) : el("span", "badge-ok", "Tout est décidé"));
    const noeuds = [entete];
    if (confirmationPile) noeuds.push(el("p", "pile-confirmation", confirmationPile));
    if (pile.length === 0) {
      noeuds.push(el("p", "discret pile-vide", "Plus aucun concours à décider. Le bot en ajoute de nouveaux à chaque passage."));
      zone.replaceChildren(...noeuds);
      return;
    }
    const c = pile[0];
    const p = presenterConcours(c, maintenant);
    const grande = el("article", "pile-carte");
    grande.append(el("div", "pile-emoji", p.emoji), el("p", "pile-titre", p.titre));
    if (p.ligne) grande.append(el("p", "pile-ligne", p.ligne));
    grande.append(el("span", p.fin.urgent ? "pile-fin pile-fin-urgent" : "pile-fin", p.fin.texte));
    noeuds.push(grande);
    const voir = lien("Voir le concours", lienPlateforme(c.url), "lien lien-pile");
    if (voir) noeuds.push(voir);
    noeuds.push(zoneDecision(c, {
      grand: true,
      apres: (action) => {
        confirmationPile = `${action === "ok" ? "Publication" : "Refus"} envoyé pour « ${p.titre} » : le bot l'appliquera à son prochain passage${textePassage()}.`;
        dessiner();
      },
    }));
    if (!decisionsDisponibles) {
      noeuds.push(el("p", "discret", EN_LIGNE
        ? "Pour décider ici, enregistre une clé GitHub (section plus bas) ; sinon réponds dans Telegram."
        : "Lecture seule : les boutons n'existent que sur le tableau privé."));
    }
    if (pile.length > 1) {
      noeuds.push(bouton("Passer pour plus tard", "bouton-secondaire pile-passer", () => {
        const deja = reportesConcours.indexOf(c.code);
        if (deja >= 0) reportesConcours.splice(deja, 1);
        reportesConcours.push(c.code);
        confirmationPile = null;
        dessiner();
      }));
    }
    zone.replaceChildren(...noeuds);
  }

  dessiner();
  return zone;
}

function carteConcours(projet, maintenant) {
  const d = objet(projet.details);
  const compteurs = objet(d.compteurs);
  const canal = d.canal ? objet(d.canal) : null;
  const liens = objet(d.liens);
  const apify = objet(d.apify);
  const youtube = objet(d.youtube);
  const cartes = liste(d.cartes);
  const passages = Array.isArray(d.passages) ? d.passages.filter((p) => typeof p === "string") : [];
  prochainPassageBot = passages.length > 0 ? passages[0] : null;
  depotConcours = depotDepuisLien(liens.depot);
  const carte = el("article", "carte carte-large");

  const alertes = trierAlertes([
    ...liste(d.a_faire),
    ...(Array.isArray(d.avertissements) ? d.avertissements.filter((x) => typeof x === "string").map((texte) => ({ niveau: "avertissement", texte })) : []),
  ]);
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", String(projet.nom ?? "Concours Gratuits FR")));
  const aSurveiller = alertes.some((a) => a.niveau === "avertissement" || a.niveau === "erreur");
  entete.append(aSurveiller ? el("span", "badge-attention", "À surveiller") : el("span", "badge-ok", "Rien d'anormal"));
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger()));
  carte.append(entete);

  const outils = groupeDeLiens(
    "fp-acces",
    lien("Canal Telegram", lienPlateforme(canal ? canal.lien : null), "lien lien-principal"),
    lien("Passages du bot (GitHub)", lienPlateforme(liens.actions)),
    lien("Dépôt du bot", lienPlateforme(liens.depot)),
  );
  const importantes = alertes.filter((a) => a.niveau !== "info" && !estRappelDeDecision(a.texte)); // la pile ci-dessous dit déjà combien il en reste
  const rappels = alertes.filter((a) => a.niveau === "info");
  if (importantes.length > 0) carte.append(blocAlertesCourt(importantes));

  // L'essentiel : les concours à décider, un par un. Tout le reste est rangé dans « Plus de détails ».
  const plus = [];
  carte.append(pileConcours(cartes, maintenant));

  const stats = el("div", "grosses-tuiles");
  if (canal) {
    const v = variation(canal.abonnes, Number.isFinite(canal.variation) ? canal.abonnes - canal.variation : null);
    const depuis = typeof canal.variation_depuis === "string" ? `${canal.variation_depuis.slice(8, 10)}/${canal.variation_depuis.slice(5, 7)}` : "?";
    stats.append(grosseTuile({ ton: "success", valeur: formaterNombre(canal.abonnes), libelle: "abonnés Telegram", detail: v.sens === "inconnu" ? "" : `${v.texte} depuis le ${depuis}` }, "👥"));
  }
  stats.append(grosseTuile({ ton: "accent", valeur: formaterNombre(compteurs.publies_7j), libelle: "publiés cette semaine", detail: `${formaterNombre(compteurs.publies)} au total` }, "📣"));
  carte.append(stats);

  const enAttente = cartes.filter((c) => c.approuve === true || c.ordre === "ok" || c.ordre === "no" || ordresEnvoyes.has(c.code));
  if (enAttente.length > 0) {
    plus.push(sectionFp(`Décidés, en attente du bot (${enAttente.length})`, false, listeFp(enAttente.map((c) => {
      const ordre = c.ordre === "ok" || c.ordre === "no" ? c.ordre : ordresEnvoyes.get(c.code);
      return ligneFp(presenterConcours(c, maintenant).titre, libelleOrdre(ordre) ?? "Accepté : publication au prochain passage");
    }), "")));
  }
  const reste = Number(compteurs.cartes) - cartes.length;
  if (reste > 0) plus.push(el("p", "discret", `${formaterNombre(reste)} autre(s) carte(s) non affichée(s).`));

  // Sans clé GitHub, les boutons de la page en ligne ne marchent pas : la section reste visible. Avec la clé, elle se range dans les détails.
  if (EN_LIGNE && !lireJetonGithub()) carte.append(sectionCleGithub());
  else if (EN_LIGNE) plus.push(sectionCleGithub());
  plus.push(sectionFp("Outils et liens", false, outils));

  // Le suivi de l'objectif et les détails du bot, repliés : on les ouvre seulement quand on en a besoin.
  const suivi = [];
  if (canal && typeof canal.abonnes === "number" && typeof canal.objectif === "number") {
    const barre = document.createElement("progress");
    barre.max = 100;
    barre.value = pourcentageQuota(canal.abonnes, canal.objectif);
    barre.setAttribute("aria-label", "Progression vers l'objectif d'abonnés");
    suivi.push(barre, el("p", "discret", `Objectif : ${formaterNombre(canal.objectif)} abonnés (${pourcentageQuota(canal.abonnes, canal.objectif)} %)`));
    const courbeAbonnes = liste(canal.courbe);
    if (courbeAbonnes.length >= 2) suivi.push(blocCourbe("Abonnés Telegram", courbeAbonnes, "valeur"));
  }
  suivi.push(el(
    "p", "discret fp-ages",
    `Refusés : ${formaterNombre(compteurs.refus)} · Expirés : ${formaterNombre(compteurs.expires)} · File d'attente du bot : ${formaterNombre(compteurs.file)}`
    + ` · Ordres envoyés pas encore appliqués : ${formaterNombre(d.ordres_en_attente)}`
    + (typeof d.dernier_passage === "string" ? ` · Dernier passage complet ${ageLisible(d.dernier_passage, maintenant)}` : "")
    + (typeof d.derniere_activite === "string" ? ` · Dernière mémoire enregistrée ${ageLisible(d.derniere_activite, maintenant)}` : ""),
  ));
  plus.push(sectionFp("Abonnés et suivi du bot", false, ...suivi));
  if (rappels.length > 0) plus.push(sectionFp(`Rappels (${rappels.length})`, false, blocAlertes(rappels)));
  plus.push(sectionFp(`Derniers concours publiés (${liste(d.publies_recents).length})`, false, listeFp(
    liste(d.publies_recents).map((p) => ligneFp(
      p.titre,
      [p.plateforme, p.publie_le ? `publié ${ageLisible(p.publie_le, maintenant)}` : null, p.fin ? `fin ${p.fin}` : null].filter(Boolean).join(" · "),
      groupeDeLiens("fp-liens", lien("Voir", lienPlateforme(p.url))),
    )),
    "Aucun concours publié.",
  )));
  if (canal) {
    plus.push(sectionFp(`Vues des dernières publications du canal (${liste(canal.publications).length})`, false, listeFp(
      liste(canal.publications).map((p) => ligneFp(
        p.texte || `Publication ${p.id}`,
        [compter(p.vues, "vue", "vues"), p.quand ? ageLisible(p.quand, maintenant) : null].filter(Boolean).join(" · "),
        groupeDeLiens("fp-liens", lien("Ouvrir", lienPlateforme(`${canal.lien}/${p.id}`))),
      )),
      "Aucune publication lue sur la page du canal.",
    )));
  }
  const barreApify = document.createElement("progress");
  barreApify.max = 100;
  barreApify.value = pourcentageQuota(apify.depense_usd, apify.plafond_usd);
  barreApify.setAttribute("aria-label", "Budget Apify utilisé ce mois-ci");
  plus.push(sectionFp(
    "Budget et quotas", false,
    barreApify,
    el("p", "discret", `Apify : ${formaterNombre(apify.depense_usd)} $ dépensés sur ${formaterNombre(apify.plafond_usd)} $ (réserve de sécurité ${formaterNombre(apify.reserve_usd)} $), cycle du ${typeof apify.cycle === "string" ? apify.cycle : "?"}`),
    el("p", "discret", `YouTube : ${formaterNombre(youtube.unites)} unités utilisées aujourd'hui, ${formaterNombre(youtube.recherches)} recherche(s).`),
  ));
  plus.push(sectionFp(`Prochains passages du bot (${passages.length})`, false, listeFp(
    passages.map((p) => ligneFp(`${delaiAvant(p, maintenant)} (${heureParis(p)}, heure de Paris)`, "")),
    "Les prochains passages sont introuvables.",
  )));
  carte.append(sectionFp("Plus de détails", false, ...plus));
  return carte;
}

function ligneCalendrier(e) {
  const titre = e.type === "prospection"
    ? `Prospection : ${Number.isFinite(e.messages) ? e.messages : "?"} message(s) privé(s)`
    : `${titreSur(e.format)}${typeof e.id === "string" ? ` · ${e.id}` : ""}`;
  const meta = [rendezVous(e), typeof e.libelle === "string" && e.type !== "prospection" ? e.libelle : null, typeof e.produit === "string" ? e.produit : null];
  const ligne = ligneFp(titre, meta.filter(Boolean).join(" · "), null);
  if (e.divulgation === true) ligne.append(el("span", "badge-attention", "Divulgation : OUI"));
  else if (e.divulgation === false) ligne.append(el("span", "discret fp-meta", "Divulgation : non"));
  if (e.en_ligne === true) ligne.append(el("span", "badge-ok", "En ligne"));
  else if (e.type === "video" && e.fichier === false) ligne.append(el("span", "badge-attention", "Fichier introuvable"));
  if (typeof e.accroche === "string") ligne.append(el("span", "discret fp-meta cc-accroche", `« ${e.accroche} »`));
  return ligne;
}

function carteProduits(projet, maintenant) {
  const d = objet(projet.details);
  const compteurs = objet(d.compteurs);
  const prochaine = d.prochaine ? objet(d.prochaine) : null;
  const calendrier = classerCalendrier(liste(d.calendrier), maintenant);
  const carte = el("article", "carte carte-large");

  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", String(projet.nom ?? "Produits numériques")));
  const retard = Number(compteurs.en_retard);
  entete.append(retard > 0 ? el("span", "badge-attention", `${retard} vidéo(s) en retard`) : el("span", "badge-ok", "Planning à jour"));
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger()));
  carte.append(entete);
  carte.append(groupeDeLiens(
    "fp-acces",
    lien("Gumroad : mes produits", "https://app.gumroad.com/products", "lien lien-principal"),
    lien("TikTok Studio : publier", "https://www.tiktok.com/tiktokstudio/upload"),
    lien("TikTok Studio : contenu", "https://www.tiktok.com/tiktokstudio/content"),
  ));
  const alertes = trierAlertes(liste(d.a_faire));
  const importantes = alertes.filter((a) => a.niveau !== "info");
  if (importantes.length > 0) carte.append(blocAlertes(importantes));

  const chiffres = el("div", "fp-chiffres");
  chiffres.append(
    tuileNombre("Produits à publier", compteurs.a_publier, `${formaterNombre(compteurs.deja_publies)} déjà publié(s)`),
    tuileTexte("Vidéos publiées", `${formaterNombre(compteurs.videos_faites)} / ${formaterNombre(compteurs.videos_prevues)}`),
    tuileNombre("En retard", compteurs.en_retard),
    tuileTexte("Prochaine publication", prochaine && prochaine.quand ? delaiAvant(prochaine.quand, maintenant) : "aucune", prochaine && prochaine.quand ? rendezVous(prochaine) : ""),
    tuileNombre("Vidéos en réserve", compteurs.reserve),
  );
  carte.append(chiffres);

  const groupe = (titre, ouvert, entrees) => sectionFp(
    `${titre} (${entrees.length})`, ouvert && entrees.length > 0,
    listeFp(entrees.slice(0, 30).map(ligneCalendrier), "Rien ici."),
    ...(entrees.length > 30 ? [el("p", "discret", `${entrees.length - 30} autre(s) non affichée(s).`)] : []),
  );
  // Ce qui est à faire bientôt d'abord ; une longue liste de retards reste repliée (le nombre est déjà dans l'en-tête).
  carte.append(
    groupe("Aujourd'hui", true, calendrier.aujourdhui),
    groupe("À venir", true, calendrier.aVenir),
    groupe("En retard", calendrier.retard.length <= 5, calendrier.retard),
    groupe("Déjà fait", false, calendrier.faits),
    groupe("En réserve", false, calendrier.reserve),
  );
  const rappelsProduits = alertes.filter((a) => a.niveau === "info");
  if (rappelsProduits.length > 0) carte.append(sectionFp(`Rappels (${rappelsProduits.length})`, false, blocAlertes(rappelsProduits)));
  const produits = liste(d.produits);
  carte.append(sectionFp(`Produits (${produits.length})`, false, listeFp(
    produits.map((p) => {
      const pieces = objet(p.pieces);
      const meta = [
        typeof p.prix === "string" ? p.prix : null,
        p.statut === "a-publier" ? "à publier" : "déjà publié",
        `${formaterNombre(pieces.pdf)} PDF · ${formaterNombre(pieces.visuels)} visuels · ${formaterNombre(pieces.videos)} vidéo(s) à poster · ${formaterNombre(pieces.videos_publiees)} en ligne`,
      ];
      const ligne = ligneFp(p.titre, meta.filter(Boolean).join(" · "), null);
      if (Array.isArray(p.manque) && p.manque.length > 0) ligne.append(el("span", "badge-attention", `Manque : ${p.manque.filter((x) => typeof x === "string").join(", ")}`));
      const r = rapprochement.disponible ? rapprochement.parLocal[p.id] : null;
      if (r && r.produit) {
        ligne.append(el("span", "badge-ok", "En ligne sur Gumroad"));
        const voir = lien("Voir", lienGumroad(r.produit.lien));
        if (voir) ligne.append(groupeDeLiens("fp-liens", voir));
        if (r.prixIdentique === false) {
          ligne.append(el("span", "badge-attention", `Prix différent : ${typeof p.prix === "string" ? p.prix : "?"} en local, ${formaterMontant(r.produit.prix_cents, "€")} en ligne`));
        }
      } else if (r) {
        ligne.append(el("span", "badge-attention", "Pas trouvé sur la boutique Gumroad"));
      }
      return ligne;
    }),
    "Aucun produit trouvé.",
  )));
  return carte;
}

// ---------- Gumroad, TikTok, revenus, vue d'ensemble ----------

const SOURCES_REVENUS = { gumroad: "Gumroad", concours: "Concours (Telegram)", tiktok: "TikTok", youtube: "YouTube", autre: "Autre" };
let etatRevenus = null; // l'état du carnet de revenus ; null sur la page publique (pas de carnet)
let messageRevenus = null; // { texte, reussi } : montré une fois, après le rafraîchissement de la page

async function lireEtatRevenus() {
  if (EN_LIGNE) return null;
  try {
    const reponse = await fetch("api/revenus/etat", { cache: "no-store" });
    return reponse.ok ? await reponse.json() : null;
  } catch {
    return null;
  }
}

function enteteDeCarte(projet, titreParDefaut, badge) {
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", String(projet.nom ?? titreParDefaut)));
  if (badge) entete.append(badge);
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger()));
  return entete;
}

function carteGumroad(projet) {
  const d = objet(projet.details);
  const boutique = d.boutique ? objet(d.boutique) : null;
  const catalogue = liste(boutique ? boutique.produits : []);
  const carte = el("article", "carte carte-large");
  const ok = d.etat === "ok";
  const badge = ok ? el("span", "badge-ok", "Ventes connectées")
    : el("span", "badge-attention", d.etat === "a-configurer" ? "Ventes : jeton à poser" : "Ventes : problème");
  carte.append(enteteDeCarte(projet, "Gumroad", badge));
  carte.append(groupeDeLiens(
    "fp-acces",
    lien("Ma boutique (publique)", lienGumroad(boutique ? boutique.lien : null), "lien lien-principal"),
    lien("Gumroad : tableau de bord", "https://app.gumroad.com/dashboard"),
    lien("Gumroad : mes produits", "https://app.gumroad.com/products"),
    lien("Gumroad : statistiques", "https://app.gumroad.com/dashboard/analytics"),
  ));

  // La boutique publique : visible sans jeton.
  if (boutique && catalogue.length > 0) {
    const prix = catalogue.map((p) => p.prix_cents).filter(Number.isInteger);
    const moyen = prix.length > 0 ? Math.round(prix.reduce((a, b) => a + b, 0) / prix.length) : null;
    const avis = catalogue.reduce((somme, p) => somme + (Number.isInteger(p.nb_avis) ? p.nb_avis : 0), 0);
    const chiffres = el("div", "fp-chiffres");
    chiffres.append(
      tuileNombre("Produits en ligne", catalogue.length),
      tuileTexte("Prix moyen", formaterMontant(moyen, "€")),
      tuileNombre("Avis reçus", avis, avis === 0 ? "aucun avis pour l'instant" : ""),
    );
    carte.append(chiffres);
    const sansDossier = new Set(rapprochement.sansDossier.map((p) => p.permalink));
    carte.append(sectionFp(`Boutique en ligne (${catalogue.length})`, true, listeFp(
      catalogue.map((p) => {
        const meta = [
          Number.isInteger(p.prix_cents) ? formaterMontant(p.prix_cents, p.devise === "EUR" ? "€" : p.devise || "") : null,
          Number.isInteger(p.nb_avis) ? (p.nb_avis > 0 ? `${p.nb_avis} avis, note ${formaterNombre(p.note)}` : "0 avis") : null,
          p.prix_libre ? "prix libre" : null,
        ];
        const ligne = ligneFp(p.nom, meta.filter(Boolean).join(" · "), groupeDeLiens("fp-liens", lien("Voir", lienGumroad(p.lien))));
        if (sansDossier.has(p.permalink)) ligne.append(el("span", "discret fp-meta", "Pas de dossier local correspondant"));
        return ligne;
      }),
      "La boutique est vide.",
    )));
  } else if (boutique) {
    carte.append(el("p", "alerte alerte-info", "La boutique publique est vide ou illisible pour le moment."));
  }

  if (!ok) {
    if (d.etat === "a-configurer" || d.etat === "jeton-invalide") {
      carte.append(el("p", "alerte alerte-action", d.etat === "jeton-invalide"
        ? "Le fichier du jeton n'a pas la bonne forme : refais-le comme indiqué ci-dessous."
        : "Pour voir les ventes et le revenu, il manque le jeton d'accès Gumroad (voir ci-dessous)."));
      if (typeof d.etape === "string") carte.append(sectionFp("Poser le jeton Gumroad", false, el("p", "discret", d.etape)));
    } else {
      carte.append(el("p", "alerte alerte-avertissement", typeof d.message === "string" ? d.message : "Gumroad ne répond pas."));
    }
    carte.append(el("p", "discret", "Gumroad ne fournit pas les vues des pages produit : seules les ventes et le revenu sont disponibles."));
    return carte;
  }

  // Les ventes et le revenu : avec le jeton.
  const produits = liste(d.produits);
  const ventes = el("div", "fp-chiffres");
  ventes.append(
    tuileNombre("Ventes", d.total_ventes),
    tuileTexte("Revenu total", formaterMontant(d.total_usd_cents, "$"), "montant en dollars, comme l'indique Gumroad"),
    tuileNombre("Produits publiés", produits.filter((p) => p.publie === true).length, `${produits.length} au total`),
  );
  carte.append(ventes);
  carte.append(sectionFp(`Ventes par produit (${produits.length})`, true, listeFp(
    produits.map((p) => ligneFp(
      p.nom,
      [Number.isInteger(p.prix_cents) ? formaterMontant(p.prix_cents, p.devise === "EUR" ? "€" : p.devise || "") : null,
        compter(p.ventes, "vente", "ventes"), `revenu ${formaterMontant(p.revenu_usd_cents, "$")}`, p.publie ? "publié" : "non publié"].filter(Boolean).join(" · "),
      groupeDeLiens("fp-liens", lien("Voir", lienGumroad(p.lien))),
    )),
    "Aucun produit trouvé sur Gumroad.",
  )));
  carte.append(el("p", "discret", "Gumroad ne fournit pas les vues des pages produit : seules les ventes et le revenu sont disponibles."));
  return carte;
}

function carteTiktok(projet, maintenant) {
  const d = objet(projet.details);
  const exports = objet(d.exports);
  const publiques = objet(d.videos_publiques);
  const comptes = liste(d.comptes);
  const carte = el("article", "carte carte-large");
  carte.append(enteteDeCarte(projet, "Analytiques TikTok", comptes.length > 0 ? el("span", "badge-ok", `${comptes.length} compte(s)`) : el("span", "badge-attention", "À configurer")));
  const alertes = trierAlertes([
    ...liste(d.a_faire),
    ...(Array.isArray(d.avertissements) ? d.avertissements.filter((x) => typeof x === "string").map((texte) => ({ niveau: "avertissement", texte })) : []),
  ]);
  if (alertes.length > 0) carte.append(blocAlertesCourt(alertes));
  const plus = []; // tout ce qui n'est pas l'essentiel : repliés dans « Plus de détails »
  for (const c of comptes) {
    carte.append(el("p", "cmd-titre", `@${String(c.compte)}${typeof c.nom === "string" ? ` (${c.nom})` : ""}`));
    const v = variation(c.abonnes, Number.isFinite(c.variation) ? c.abonnes - c.variation : null);
    const depuis = typeof c.variation_depuis === "string" ? `${c.variation_depuis.slice(8, 10)}/${c.variation_depuis.slice(5, 7)}` : "?";
    const suivies = objet(objet(publiques.par_compte)[c.compte]);
    const tuiles = el("div", "grosses-tuiles");
    tuiles.append(
      grosseTuile({ ton: "success", valeur: formaterNombre(c.abonnes), libelle: "abonnés", detail: v.sens === "inconnu" ? "" : `${v.texte} depuis le ${depuis}` }, "👥"),
      grosseTuile({ ton: "accent", valeur: formaterNombre(c.vues_total), libelle: "vues", detail: Number.isFinite(suivies.suivies) ? `${suivies.lues ?? 0} vidéo(s) lue(s) sur ${suivies.suivies}` : "" }, "👀"),
    );
    carte.append(tuiles, el("p", "discret", `${formaterNombre(c.jaime)} j'aime · ${formaterNombre(c.videos)} vidéos`));
    const courbesCompte = [];
    if (liste(c.courbe).length >= 2) courbesCompte.push(blocCourbe(`Abonnés @${String(c.compte)}`, liste(c.courbe), "valeur"));
    if (liste(c.courbe_vues).length >= 2) courbesCompte.push(blocCourbe(`Vues @${String(c.compte)}`, liste(c.courbe_vues), "valeur"));
    if (courbesCompte.length > 0) plus.push(sectionFp(`Évolution @${String(c.compte)}`, false, ...courbesCompte));
  }
  const ligneVideoTiktok = (v) => ligneFp(
    abreger(v.titre, 90),
    [`@${String(v.compte)}`, compter(v.vues, "vue", "vues"), compter(v.likes, "like", "likes"), compter(v.commentaires, "commentaire", "commentaires"),
      compter(v.partages, "partage", "partages"), typeof v.publie_le === "string" ? `publiée ${ageLisible(v.publie_le, maintenant)}` : null]
      .filter((x) => typeof x === "string" && x !== "?" && x !== "@undefined").join(" · "),
    groupeDeLiens("fp-liens", lien("Voir", lienTiktok(v.lien))),
  );
  const ligneExport = (v) => ligneFp(
    abreger(v.titre, 90),
    [compter(v.vues, "vue", "vues"), compter(v.likes, "like", "likes"), compter(v.commentaires, "commentaire", "commentaires"),
      compter(v.partages, "partage", "partages"), typeof v.date === "string" ? v.date : null].filter((x) => typeof x === "string" && x !== "?").join(" · "),
    groupeDeLiens("fp-liens", lien("Voir", lienTiktok(v.lien))),
  );
  // Le palmarès : les 3 premières vidéos en vue, les suivantes dans une section repliée.
  const palmares = (titre, videos, ligneDe, vide, introduction) => {
    const reste = videos.length > 3 ? [sectionFp(`Voir les ${videos.length - 3} autres`, false, listeFp(videos.slice(3).map(ligneDe), ""))] : [];
    return sectionFp(`${titre} (${videos.length})`, true, ...(introduction ? [introduction] : []), listeFp(videos.slice(0, 3).map(ligneDe), vide), ...reste);
  };
  if (Number(publiques.suivies) > 0) {
    const lues = Number(publiques.lues);
    carte.append(palmares("Vidéos les plus vues", liste(publiques.liste), ligneVideoTiktok,
      lues === 0 ? "Première lecture en cours : revenez dans une minute." : "Aucune vidéo lisible."));
    plus.push(el("p", "discret", `Lecture publique, sans connexion : ${lues} vidéo(s) lue(s) sur ${publiques.suivies} suivies`
      + `${typeof publiques.maj === "string" ? `, dernière lecture ${ageLisible(publiques.maj, maintenant)}` : ""}. Chaque vidéo est relue toutes les 6 heures.`));
  }
  if (Number(exports.nb_fichiers) > 0) {
    const tuiles = el("div", "grosses-tuiles");
    tuiles.append(
      grosseTuile({ ton: "accent", valeur: formaterNombre(exports.total_vues), libelle: "vues (exports)", detail: `${formaterNombre(exports.nb_videos)} vidéos suivies` }, "👀"),
    );
    carte.append(tuiles, palmares("Vidéos les plus vues (exports)", liste(exports.videos), ligneExport, "Aucune vidéo dans les exports."));
  }
  plus.push(
    groupeDeLiens(
      "fp-acces",
      lien("TikTok Studio : analyses", "https://www.tiktok.com/tiktokstudio/analytics", "lien lien-principal"),
      lien("TikTok Studio : contenu", "https://www.tiktok.com/tiktokstudio/content"),
    ),
    el("p", "discret", "Les chiffres viennent des pages publiques TikTok (sans connexion) ; les analyses privées (audience, temps de visionnage) exigent un export CSV de TikTok Studio. Pour suivre une nouvelle vidéo, ajoute son adresse dans videos.txt."),
  );
  carte.append(sectionFp("Plus de détails", false, ...plus));
  return carte;
}

function sectionEntreesRevenus(etat) {
  const entrees = liste(etat.entrees);
  return sectionFp(`Dernières entrées (${entrees.length})`, false, listeFp(
    entrees.map((e) => ligneFp(
      `${formaterMontant(e.montant_cents, "€")} · ${SOURCES_REVENUS[e.source] ?? String(e.source)}`,
      [typeof e.date === "string" ? e.date : null, typeof e.note === "string" ? e.note : null].filter(Boolean).join(" · "),
    )),
    "Aucune entrée.",
  ));
}

function carteRevenus(etat) {
  const carte = el("article", "carte carte-large");
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", "Revenus"), el("span", "badge-attention", "Saisie à la main"), bouton("Actualiser", "bouton-secondaire", () => charger()));
  carte.append(entete);
  carte.append(el("p", "discret", EN_LIGNE
    ? "Copie en lecture seule du carnet tenu sur le PC. Le revenu Gumroad automatique est dans sa propre carte."
    : "Note ici chaque rentrée d'argent (ce carnet reste sur le PC). Le revenu Gumroad automatique est dans sa propre carte."));
  const chiffres = el("div", "fp-chiffres");
  chiffres.append(
    tuileTexte("Total", formaterMontant(etat.total_cents, "€")),
    tuileTexte("Ce mois-ci", formaterMontant(etat.mois_courant_cents, "€")),
    tuileNombre("Entrées", etat.nb),
  );
  carte.append(chiffres);
  const parSource = Object.entries(objet(etat.par_source)).filter(([, c]) => Number.isInteger(c));
  if (parSource.length > 0) {
    carte.append(sectionFp("Par source", true, listeFp(
      parSource.sort((a, b) => b[1] - a[1]).map(([source, cents]) => ligneFp(SOURCES_REVENUS[source] ?? source, formaterMontant(cents, "€"))),
      "",
    )));
  }
  const parMois = liste(etat.par_mois);
  if (parMois.length > 0) {
    carte.append(sectionFp("Par mois", false, listeFp(parMois.map((m) => ligneFp(String(m.mois), formaterMontant(m.cents, "€"))), "")));
  }
  if (EN_LIGNE) {
    carte.append(sectionEntreesRevenus(etat)); // en ligne : lecture seule, le carnet se remplit depuis le PC
    return carte;
  }

  // Formulaire (sans <form> : la page n'envoie rien ailleurs que par ses propres appels)
  const message = el("p", "cmd-message");
  message.setAttribute("role", "status");
  if (messageRevenus) {
    ecrireMessage(message, messageRevenus.texte, messageRevenus.reussi ? "ok" : "erreur");
    messageRevenus = null;
  }
  const champ = (libelle, noeud) => {
    const etiquette = el("label", "rev-champ");
    etiquette.append(el("span", "discret", libelle), noeud);
    return etiquette;
  };
  const date = el("input");
  date.type = "date";
  date.value = jourParis(new Date());
  const source = el("select");
  for (const nom of Array.isArray(etat.sources) ? etat.sources : Object.keys(SOURCES_REVENUS)) {
    const option = el("option", "", SOURCES_REVENUS[nom] ?? nom);
    option.value = nom;
    source.append(option);
  }
  const montant = el("input");
  montant.type = "text";
  montant.inputMode = "decimal";
  montant.autocomplete = "off";
  montant.placeholder = "7,90";
  montant.maxLength = 12;
  const note = el("input");
  note.type = "text";
  note.autocomplete = "off";
  note.maxLength = 100;
  note.placeholder = "Ex. vente du planner";
  const ajouter = bouton("Ajouter", "bouton-principal", async () => {
    ajouter.disabled = true;
    const reponse = await poster("api/revenus/ajouter", { date: date.value, source: source.value, montant: montant.value, note: note.value });
    if (reponse.ok) messageRevenus = { texte: "Revenu ajouté.", reussi: true };
    else messageRevenus = { texte: reponse.json && reponse.json.erreur ? reponse.json.erreur : "Ajout impossible.", reussi: false };
    await charger();
  });
  const formulaire = el("div", "rev-formulaire");
  formulaire.append(champ("Date", date), champ("Source", source), champ("Montant (€)", montant), champ("Note", note), ajouter);
  carte.append(el("p", "cmd-titre", "Ajouter un revenu"), formulaire, message);

  const entrees = liste(etat.entrees);
  carte.append(sectionEntreesRevenus(etat));
  if (entrees.length > 0 && Number.isInteger(etat.derniere_id)) {
    const supprimer = bouton("Supprimer la dernière entrée", "bouton-secondaire", () => {
      if (supprimer.dataset.arme !== "1") {
        supprimer.dataset.arme = "1";
        supprimer.textContent = "Confirmer la suppression";
        setTimeout(() => { supprimer.dataset.arme = ""; supprimer.textContent = "Supprimer la dernière entrée"; }, 6000);
        return;
      }
      supprimer.disabled = true;
      poster("api/revenus/supprimer", { id: etat.derniere_id }).then(async (reponse) => {
        messageRevenus = reponse.ok
          ? { texte: "Dernière entrée supprimée.", reussi: true }
          : { texte: reponse.json && reponse.json.erreur ? reponse.json.erreur : "Suppression impossible.", reussi: false };
        await charger();
      });
    });
    carte.append(supprimer);
  }
  return carte;
}

// ---------- Boutique : produits, ventes et revenus au même endroit ----------

function carteBoutique(produits, gumroad, etat, carteDesRevenus, maintenant) {
  const carte = el("article", "carte carte-large");
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", "Boutique"), bouton("Actualiser", "bouton-secondaire", () => charger()));
  carte.append(entete);

  const g = objet(gumroad && gumroad.details);
  const catalogue = liste(g.boutique ? objet(g.boutique).produits : []);
  const p = objet(produits && produits.details);
  const compteurs = objet(p.compteurs);
  const calendrier = classerCalendrier(liste(p.calendrier), maintenant);
  const prochaine = p.prochaine ? objet(p.prochaine) : null;

  const tuiles = el("div", "grosses-tuiles");
  const revenu = tuilesAccueil(gumroad ? [gumroad] : [], etat).find((t) => t.id === "revenu");
  if (revenu) tuiles.append(grosseTuile({ ...revenu, cible: null }, "💰"));
  if (catalogue.length > 0) {
    const prix = catalogue.map((x) => x.prix_cents).filter(Number.isInteger);
    const moyen = prix.length > 0 ? Math.round(prix.reduce((a, b) => a + b, 0) / prix.length) : null;
    tuiles.append(grosseTuile({ ton: "success", valeur: formaterNombre(catalogue.length), libelle: "produits en ligne", detail: moyen === null ? "" : `prix moyen ${formaterMontant(moyen, "€")}` }, "🛍️"));
  }
  if (produits) {
    const retard = Number(compteurs.en_retard);
    tuiles.append(
      grosseTuile({ ton: "accent", valeur: formaterNombre(calendrier.aujourdhui.length), libelle: "vidéos à poster aujourd'hui", detail: prochaine && prochaine.quand ? `prochaine ${delaiAvant(prochaine.quand, maintenant)}` : "" }, "🎬"),
      grosseTuile({ ton: retard > 0 ? "warning" : "success", valeur: formaterNombre(Number.isFinite(retard) ? retard : null), libelle: "vidéos en retard", detail: `${formaterNombre(compteurs.videos_faites)} sur ${formaterNombre(compteurs.videos_prevues)} publiées` }, "⏰"),
    );
  }
  if (tuiles.childElementCount > 0) carte.append(tuiles);

  const aVerifier = groupesDeTaches([produits, gumroad].filter(Boolean))[0];
  if (aVerifier) {
    carte.append(el("p", `alerte alerte-${aVerifier.niveau === "erreur" ? "erreur" : "avertissement"}`,
      `${aVerifier.nb > 1 ? `${aVerifier.nb} points à vérifier, dont : ` : ""}${aVerifier.texte}`));
  }

  if (catalogue.length > 0) {
    const grille = el("div", "produits-mini");
    for (const produit of catalogue) {
      const prix = Number.isInteger(produit.prix_cents) ? formaterMontant(produit.prix_cents, produit.devise === "EUR" ? "€" : produit.devise || "") : "";
      const vignette = lien("", lienGumroad(produit.lien), "produit-mini") ?? el("div", "produit-mini");
      vignette.append(el("span", "pm-nom", nomCourtProduit(produit.nom)), el("span", "pm-prix", prix));
      grille.append(vignette);
    }
    carte.append(grille);
  } else if (gumroad && g.boutique) {
    carte.append(el("p", "alerte alerte-info", "La boutique publique est vide ou illisible pour le moment."));
  }

  const nichee = (noeud) => {
    noeud.classList.add("carte-imbriquee");
    return noeud;
  };
  if (produits) carte.append(sectionFp("Calendrier de publication et produits", false, nichee(carteSure(produits, maintenant, carteProduits))));
  if (gumroad) carte.append(sectionFp("Ventes Gumroad en détail", false, nichee(carteSure(gumroad, maintenant, carteGumroad))));
  if (carteDesRevenus) carte.append(sectionFp("Revenus saisis à la main", false, nichee(carteDesRevenus)));
  return carte;
}

// ---------- Accueil : l'essentiel d'un coup d'œil ----------

const ICONES_TUILES = { concours: "🎁", abonnes: "👥", revenu: "💰", live: "🔴" };
const MAX_A_FAIRE = 3;

// Quatre gros chiffres, ce qu'il faut faire en premier (trois lignes au plus, une par thème), le prochain rendez-vous.
function blocAccueil(projets, etat, maintenant) {
  const tuiles = tuilesAccueil(projets, etat);
  const groupes = groupesDeTaches(projets);
  const agenda = construireAgenda(projets, maintenant);
  if (tuiles.length === 0 && groupes.length === 0 && agenda.length === 0) return null;
  const section = el("section", "accueil");
  if (tuiles.length > 0) {
    const grille = el("div", "grosses-tuiles");
    for (const t of tuiles) grille.append(grosseTuile(t, ICONES_TUILES[t.id]));
    section.append(grille);
  }

  const ligneDe = (groupe) => {
    const ligne = el("button", "faire-ligne");
    ligne.type = "button";
    const corps = el("span", "faire-corps");
    corps.append(el("span", "faire-nom", groupe.nb > 1 ? `${groupe.nom} · ${groupe.nb}` : groupe.nom), el("span", "faire-texte", groupe.texte));
    ligne.append(el("span", groupe.niveau === "erreur" ? "faire-point faire-point-erreur" : "faire-point"), corps);
    if (groupe.cible) ligne.addEventListener("click", () => allerVersOnglet(groupe.cible));
    return ligne;
  };
  const carte = el("article", "carte carte-large");
  carte.append(el("p", "cmd-titre", groupes.length > 0 ? "À faire en premier" : "Rien d'urgent"));
  for (const groupe of groupes.slice(0, MAX_A_FAIRE)) carte.append(ligneDe(groupe));
  if (groupes.length > MAX_A_FAIRE) carte.append(sectionFp(`Voir le reste (${groupes.length - MAX_A_FAIRE})`, false, ...groupes.slice(MAX_A_FAIRE).map(ligneDe)));
  if (agenda.length > 0) {
    carte.append(el("p", "accueil-rdv", `Prochain rendez-vous : ${agenda[0].texte} · ${delaiAvant(agenda[0].quand, maintenant)}`));
    if (agenda.length > 1) {
      carte.append(sectionFp(`Voir les ${agenda.length - 1} suivants`, false, listeFp(
        agenda.slice(1).map((e) => ligneFp(e.texte, `${delaiAvant(e.quand, maintenant)} · ${rendezVous({ quand: e.quand })} · ${e.source}`)),
        "",
      )));
    }
  }
  section.append(carte);
  return section;
}

// Une carte qui plante sur des données inattendues ne doit pas faire disparaître la page : on la remplace par un message.
function carteSure(projet, maintenant, construire) {
  try {
    return construire(projet, maintenant);
  } catch {
    const carte = el("article", "carte carte-large");
    carte.append(el("h3", "", String(projet.nom ?? "Projet")), el("p", "alerte alerte-erreur", "Données illisibles pour ce projet."));
    return carte;
  }
}

function carteDuProjet(projet, maintenant) {
  if (projet.adaptateur === "bot-concours" && projet.statut === "ok") return carteSure(projet, maintenant, carteConcours);
  if (projet.adaptateur === "produits-numeriques" && projet.statut === "ok") return carteSure(projet, maintenant, carteProduits);
  if (projet.adaptateur === "gumroad" && projet.statut === "ok") return carteSure(projet, maintenant, carteGumroad);
  if (projet.adaptateur === "tiktok" && projet.statut === "ok") return carteSure(projet, maintenant, carteTiktok);
  if (projet.adaptateur === "falling-pickaxe" && projet.statut === "ok") {
    try {
      return carteFallingPickaxe(projet, maintenant);
    } catch {
      const carte = el("article", "carte carte-large");
      carte.append(el("h3", "", String(projet.nom ?? "Falling Pickaxe")), el("p", "alerte alerte-erreur", "Données illisibles pour ce projet."));
      return carte;
    }
  }
  return carteProjet(projet);
}

// ---------- Onglets : un thème à la fois, pour ne pas faire défiler toute la page sur téléphone ----------

const CLE_ONGLET = "tableau.onglet";
const ICONES_ONGLETS = { resume: "🏠", concours: "🎁", boutique: "🛍️", tiktok: "🎵", live: "🔴", autres: "📁" };
let ongletActif = null;
let allerVersOnglet = () => {}; // rebranché à chaque affichage : ouvre l'onglet demandé (tuiles et lignes de l'accueil)

function lireOngletMemorise() {
  try {
    return window.localStorage.getItem(CLE_ONGLET);
  } catch {
    return null; // navigation privée ou stockage bloqué : on retombe sur le premier onglet
  }
}

function memoriserOnglet(id) {
  try {
    window.localStorage.setItem(CLE_ONGLET, id);
  } catch {
    // rien à retenir : la page marche sans
  }
}

function barreDOnglets(onglets, panneaux, projets) {
  const barre = el("div", "onglets");
  barre.setAttribute("role", "tablist");
  barre.setAttribute("aria-label", "Rubriques du tableau");
  const boutons = [];
  const choisir = (id, focus = false) => {
    ongletActif = id;
    memoriserOnglet(id);
    for (const b of boutons) {
      const actif = b.dataset.onglet === id;
      b.setAttribute("aria-selected", String(actif));
      b.tabIndex = actif ? 0 : -1;
      if (actif && focus) b.focus();
    }
    for (const [cle, panneau] of panneaux) panneau.hidden = cle !== id;
  };
  onglets.forEach((o, i) => {
    const bouton = el("button", "onglet");
    bouton.type = "button";
    bouton.setAttribute("role", "tab");
    bouton.dataset.onglet = o.id;
    bouton.id = `onglet-${o.id}`;
    bouton.setAttribute("aria-controls", `panneau-${o.id}`);
    bouton.append(el("span", "onglet-icone", ICONES_ONGLETS[o.id] ?? "📁"), el("span", "onglet-titre", o.titre));
    const pastille = pastilleOnglet(o.id, projets);
    if (pastille) bouton.append(el("span", `pastille pastille-${pastille.niveau}`, pastille.texte));
    bouton.addEventListener("click", () => {
      choisir(o.id);
      window.scrollTo(0, 0);
    });
    bouton.addEventListener("keydown", (e) => {
      const decalage = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (decalage === 0) return;
      e.preventDefault();
      choisir(onglets[(i + decalage + onglets.length) % onglets.length].id, true);
    });
    boutons.push(bouton);
    barre.append(bouton);
  });
  allerVersOnglet = (id) => {
    if (!onglets.some((o) => o.id === id)) return;
    choisir(id);
    window.scrollTo(0, 0);
  };
  return { barre, choisir };
}

function afficher(paquet) {
  const maintenant = new Date();
  // Sources fraîches d'abord, les périmées ensuite ; à égalité, ordre alphabétique.
  const rang = (r) => (estPerime(r.releve_a, maintenant, r.seuil_perime_heures) ? 1 : 0);
  const sources = Object.entries(paquet.releves).sort(([a, ra], [b, rb]) => rang(ra) - rang(rb) || a.localeCompare(b));
  const projets = sources.flatMap(([, r]) => (r && Array.isArray(r.projets) ? r.projets : []));
  try {
    const gumroad = projets.find((p) => p && p.adaptateur === "gumroad");
    const locaux = projets.filter((p) => p && p.adaptateur === "produits-numeriques").flatMap((p) => liste(objet(p.details).produits));
    const boutique = gumroad ? objet(gumroad.details).boutique : null;
    rapprochement = { ...rapprocherProduits(locaux, boutique), disponible: liste(objet(boutique).produits).length > 0 };
  } catch {
    rapprochement = { parLocal: {}, sansDossier: [], disponible: false };
  }
  // Une source périmée (PC éteint, collecte arrêtée) est signalée en haut, avant tout onglet.
  const peremptions = sources
    .filter(([, r]) => estPerime(r.releve_a, maintenant, r.seuil_perime_heures))
    .map(([id, r]) => el("p", "avertissement", `${NOMS_SOURCES[id] ?? id} : ces données sont anciennes (PC éteint ou collecte arrêtée), ne vous y fiez pas. Mises à jour ${ageLisible(r.releve_a, maintenant)}.`));
  let vue = null;
  try {
    vue = blocAccueil(projets, etatRevenus, maintenant);
  } catch {
    vue = null; // l'accueil est un plus : une donnée inattendue ne doit pas cacher les cartes
  }
  let revenus = null;
  if (etatRevenus) {
    try {
      revenus = carteRevenus(etatRevenus);
    } catch {
      revenus = null;
    }
  }
  const onglets = rangerEnOnglets(projets, revenus ? ["boutique"] : []).filter((o) => o.id !== "resume" || vue);
  const panneaux = new Map();
  for (const o of onglets) {
    const panneau = el("section", "panneau");
    panneau.id = `panneau-${o.id}`;
    panneau.setAttribute("role", "tabpanel");
    panneau.setAttribute("aria-labelledby", `onglet-${o.id}`);
    if (o.id === "resume") panneau.append(vue);
    const cartes = el("div", "cartes");
    if (o.id === "boutique") {
      // Produits, boutique Gumroad et revenus ne font qu'une carte ; un projet de cet onglet en erreur garde sa carte d'erreur.
      const produits = o.projets.find((p) => p.adaptateur === "produits-numeriques" && p.statut === "ok") ?? null;
      const gumroad = o.projets.find((p) => p.adaptateur === "gumroad" && p.statut === "ok") ?? null;
      if (produits || gumroad || revenus) {
        try {
          cartes.append(carteBoutique(produits, gumroad, etatRevenus, revenus, maintenant));
        } catch {
          const erreur = el("article", "carte carte-large");
          erreur.append(el("h3", "", "Boutique"), el("p", "alerte alerte-erreur", "Données illisibles pour la boutique."));
          cartes.append(erreur);
        }
      }
      for (const projet of o.projets) if (projet !== produits && projet !== gumroad) cartes.append(carteDuProjet(projet, maintenant));
    } else {
      for (const projet of o.projets) cartes.append(carteDuProjet(projet, maintenant));
    }
    if (cartes.childElementCount > 0) panneau.append(cartes);
    panneaux.set(o.id, panneau);
  }
  const noeuds = [...peremptions];
  if (onglets.length === 0) {
    noeuds.push(el("p", "discret", "Aucun projet dans ce relevé."));
  } else if (onglets.length === 1) {
    noeuds.push(panneaux.get(onglets[0].id)); // un seul thème (page publique, démonstration) : pas de barre d'onglets
  } else {
    const { barre, choisir } = barreDOnglets(onglets, panneaux, projets);
    const memorise = lireOngletMemorise();
    const choix = [ongletActif, memorise].find((id) => onglets.some((o) => o.id === id)) ?? onglets[0].id;
    choisir(choix);
    noeuds.push(barre, ...panneaux.values());
  }
  contenu.replaceChildren(...noeuds);
  contenu.hidden = false;
  message.textContent = "";
  generation.textContent = EN_LIGNE && chargeEnLigne
    ? `Données relevées sur le PC ${ageLisible(paquet.genere_a, maintenant)} · publiées ${ageLisible(chargeEnLigne.publie_a, maintenant)}`
    : `Page générée ${ageLisible(paquet.genere_a, maintenant)}`;
}

// ---------- Mode en ligne : page publique, données chiffrées, boutons ✅ / ❌ par la boîte aux ordres de GitHub ----------

const CLE_MOT_DE_PASSE = "tableau.mot_de_passe";
const CLE_JETON_GITHUB = "tableau.jeton_github";
let motDePasse = null; // gardé en mémoire tant que la page est ouverte
let chargementEnCours = false;
let chargeEnLigne = null; // { paquet, revenus, publie_a } : le contenu du fichier chiffré une fois ouvert

function lireStockage(cle) {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null; // stockage bloqué (navigation privée) : on redemandera à chaque ouverture
  }
}

function ecrireStockage(cle, valeur) {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    // rien à retenir : la page marche sans
  }
}

function oublierStockage(cle) {
  try {
    window.localStorage.removeItem(cle);
  } catch {
    // idem
  }
}

// La clé GitHub des ordres : fournie avec les données chiffrées si le tableau en a une, sinon celle enregistrée sur cet appareil.
const choixCleGithub = () => (EN_LIGNE ? choisirCleGithub(chargeEnLigne, lireStockage(CLE_JETON_GITHUB)) : null);
const lireJetonGithub = () => { const choix = choixCleGithub(); return choix ? choix.cle : null; };

// Le formulaire du mot de passe ; la promesse rend { valeur, souvenir } quand on valide.
function demanderMotDePasse(erreurAffichee) {
  return new Promise((resolve) => {
    const formulaire = el("form", "verrou");
    const champ = el("input");
    champ.type = "password";
    champ.name = "mot-de-passe";
    champ.id = "mot-de-passe";
    champ.autocomplete = "current-password";
    champ.required = true;
    champ.setAttribute("aria-label", "Mot de passe");
    const souvenir = el("input");
    souvenir.type = "checkbox";
    souvenir.checked = true;
    const etiquetteSouvenir = el("label", "verrou-souvenir");
    etiquetteSouvenir.append(souvenir, el("span", "", "Rester connecté sur cet appareil"));
    const valider = el("button", "bouton bouton-principal", "Ouvrir");
    valider.type = "submit";
    const retour = el("p", "cmd-message");
    retour.setAttribute("role", "status");
    if (erreurAffichee) ecrireMessage(retour, "Mot de passe incorrect.", "erreur");
    formulaire.append(
      el("h2", "", "Tableau de bord verrouillé"),
      el("p", "discret", "Entrez le mot de passe : il sert à ouvrir les données, sur cet appareil seulement."),
      champ, etiquetteSouvenir, valider, retour,
    );
    formulaire.addEventListener("submit", (evenement) => {
      evenement.preventDefault();
      if (champ.value) resolve({ valeur: champ.value, souvenir: souvenir.checked });
    });
    contenu.replaceChildren(formulaire);
    contenu.hidden = false;
    message.textContent = "";
    champ.focus();
  });
}

// Télécharge le fichier chiffré et l'ouvre (le mot de passe mémorisé d'abord, sinon on le demande).
async function lireChargeEnLigne() {
  const reponse = await fetch("data.enc.json", { cache: "no-store" });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const enveloppe = await reponse.json();
  let erreurAffichee = false;
  let aMemoriser = false;
  for (;;) {
    if (motDePasse === null) {
      const memorise = erreurAffichee ? null : lireStockage(CLE_MOT_DE_PASSE);
      if (memorise) {
        motDePasse = memorise;
      } else {
        const saisie = await demanderMotDePasse(erreurAffichee);
        motDePasse = saisie.valeur;
        aMemoriser = saisie.souvenir;
      }
    }
    try {
      const charge = await dechiffrer(enveloppe, await deriverCle(motDePasse, enveloppe));
      if (aMemoriser) ecrireStockage(CLE_MOT_DE_PASSE, motDePasse);
      return charge;
    } catch (e) {
      if (!e || e.code !== "mot-de-passe") throw e;
      motDePasse = null; // mauvais mot de passe : on l'oublie partout et on le redemande
      oublierStockage(CLE_MOT_DE_PASSE);
      erreurAffichee = true;
    }
  }
}

if (EN_LIGNE) {
  const entete = document.querySelector(".entete");
  if (entete) {
    entete.append(bouton("Verrouiller", "bouton-secondaire", () => {
      oublierStockage(CLE_MOT_DE_PASSE);
      motDePasse = null;
      window.location.reload();
    }));
  }
}

async function chargerUneFois() {
  let paquet;
  try {
    if (EN_LIGNE) {
      chargeEnLigne = await lireChargeEnLigne();
      paquet = chargeEnLigne.paquet;
    } else {
      const reponse = await fetch("data.json", { cache: "no-store" });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      paquet = await reponse.json();
    }
  } catch {
    afficherMessage("Aucune donnée disponible.", "erreur");
    return;
  }
  try {
    const projets = Object.values(paquet.releves).flatMap((r) => (r && Array.isArray(r.projets) ? r.projets : []));
    const bot = projets.find((p) => p && p.adaptateur === "bot-concours");
    depotConcours = depotDepuisLien(objet(objet(objet(bot).details).liens).depot);
  } catch {
    depotConcours = null;
  }
  decisionsDisponibles = EN_LIGNE ? Boolean(lireJetonGithub()) : (await lireEtatDecisions()) !== null;
  if (EN_LIGNE && decisionsDisponibles) await lireOrdresEnAttenteGithub();
  etatRevenus = EN_LIGNE ? ((chargeEnLigne && chargeEnLigne.revenus) || null) : await lireEtatRevenus();
  const ouvertes = Array.from(document.querySelectorAll("details.fp-section")).map((d) => d.open);
  try {
    afficher(paquet);
  } catch {
    afficherMessage("Données illisibles : le fichier est abîmé ou d'une version inconnue.", "erreur");
    return;
  }
  // La page se redessine : on garde les sections que l'utilisateur avait ouvertes ou fermées (même structure seulement).
  const sections = Array.from(document.querySelectorAll("details.fp-section"));
  if (sections.length === ouvertes.length) sections.forEach((d, i) => { d.open = ouvertes[i]; });
}

// Une seule lecture à la fois : le rafraîchissement automatique ne doit pas empiler des formulaires de mot de passe.
async function charger() {
  if (chargementEnCours) return;
  chargementEnCours = true;
  try {
    await chargerUneFois();
  } finally {
    chargementEnCours = false;
  }
}

charger();
// Rafraîchissement automatique, sauf pendant une confirmation ou quand l'onglet est caché.
setInterval(() => {
  if (confirmationsOuvertes === 0 && !document.hidden) charger();
}, DELAI_RAFRAICHISSEMENT_MS);
