// Page du tableau de bord : récupère data.json et affiche les relevés.
// Le DOM est construit avec textContent uniquement (jamais innerHTML).
import {
  ageLisible, estPerime, libelleStatut,
  formaterNombre, variation, pourcentageQuota, alertesFalling, pointsCourbe,
  lienSur, lienVideo, lienAnalytiquesVideo, lienAnalytiquesChaine, lienStudio, lienChaine, lienDirect,
  actionAffichee, attenteTerminee, messageApresConfirmation,
  lienPlateforme, delaiAvant, classerCalendrier, libelleOrdre, trierAlertes,
  jourParis, formaterMontant, construireAgenda, groupesDeTaches, tuilesAccueil, presenterConcours, pileDeConcours, libelleFin, plateformesDeLaPile, groupesDeRefus, statsConcours, estRappelDeDecision, ventesRecentes, revenuParPeriode, courbeRevenu, symboleDevise, progressionObjectifTelegram, bilanSemaine, nomCourtProduit, abreger, commandeLiveEnLigne, titreOrdreLive, actionsLiveEnAttente, reponseDuPc, messagePcEteint, fusionnerReleveCloud, distanceTiree, doitActualiser, historiqueDesOrdres, lienGumroad, lienTiktok,
  rangerEnOnglets, pastilleOnglet, rapprocherProduits, depotDepuisLien, cleGithubValide, messageErreurGithub, choisirCleGithub,
  depotProspection, lireListeProspection, classerProspection, resumeProspection, tacheProspection, titreOrdreProspection,
  ordresProspectionEnAttente, reponseDuWorkflow, messageListeProspection, ligneVideosDeDemain,
  doitRedessiner, empreinteDuRendu, directionGlisse, decisionDeGlisse, GLISSE_APERCU_PX, entierAnimable, valeurAnimee,
  zoneSousCourbe, dernierPoint, salutation, phraseAccueil, traitsIcone,
  fileEnvoiValide, ajouterDecision, retirerDecision, prochainEnvoi, toucheDeTri,
  comptesTiktokDeLOnglet, rappelsDuCompte, rappelsGenerauxTiktok, videosDuCompte, groupesTelegramDe,
  videosDeLAgenda, groupesAgenda, texteHashtags, idsFaitsValides, basculerFait, pastillePublier, messageAgendaVide, modeEnregistrement,
  adresseVideoGithub, sourceVideo, videosChiffrees, adresseVideoChiffree, nomDeVideo, lignesEtatProjet,
} from "./lib.js";
import { deriverCle, dechiffrer, dechiffrerOctets } from "./chiffre.js";

const SVG = "http://www.w3.org/2000/svg";

const STATUTS_CONNUS = ["ok", "introuvable", "pas-de-git", "aucun-commit", "erreur"];

const message = document.getElementById("message");
const contenu = document.getElementById("contenu");
const generation = document.getElementById("generation");
// Page publiée en ligne (GitHub Pages) : pas de serveur privé, les données sont dans un fichier chiffré que le mot de passe ouvre.
const EN_LIGNE = document.body.dataset.mode === "en-ligne";

// « Réduire les animations » demandé par le téléphone : plus de mouvement du tout (le CSS s'éteint aussi tout seul).
const REDUIRE_MOUVEMENT = window.matchMedia("(prefers-reduced-motion: reduce)");
const sansMouvement = () => REDUIRE_MOUVEMENT.matches;
document.body.classList.add("entree"); // retirée peu après le premier affichage : seules les apparitions du début sont animées

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
    if (details.type === "dossier") {
      // Un dossier sans dépôt git : la date de sa dernière modification et le nombre de fichiers (jamais leur contenu).
      const quand = typeof details.derniere_modification === "string" ? details.derniere_modification : null;
      ligneDetail(liste, "Dernière modification", quand ? `${dateLocale(quand)} (${ageLisible(quand, new Date())})` : "aucun fichier");
      ligneDetail(liste, "Fichiers", `${formaterNombre(details.nb_fichiers)}${details.tronque === true ? " ou plus" : ""}`);
    } else if (details.type === "etat-projet") {
      // Un projet qui tient lui-même son état (etat_projet.json) : étape, suite, chiffres clés, gestes à faire.
      for (const [nom, valeur] of lignesEtatProjet(details)) ligneDetail(liste, nom, valeur);
      if (typeof details.mis_a_jour === "string") ligneDetail(liste, "Mis à jour", `${dateLocale(details.mis_a_jour)} (${ageLisible(details.mis_a_jour, new Date())})`);
    } else {
      ligneDetail(liste, "Branche", details.branche ?? "?");
      ligneDetail(liste, "Dernier commit", commit.sujet ?? "?");
      ligneDetail(liste, "Date du commit", commit.date ? dateLocale(commit.date) : "?");
      ligneDetail(liste, "Modifications non validées", String(details.modifications_non_validees ?? "?"));
    }
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
    degradeDesCourbes();
    const zone = document.createElementNS(SVG, "polygon");
    zone.setAttribute("points", zoneSousCourbe(points, 60)); // 60 = bas de l'image (viewBox -4 + 64)
    zone.setAttribute("class", "courbe-zone");
    const ligne = document.createElementNS(SVG, "polyline");
    ligne.setAttribute("points", points);
    svg.append(zone, ligne);
    const fin = dernierPoint(points);
    if (fin) {
      // Un trait de longueur nulle au bout arrondi = un rond, qui reste rond même quand l'image est étirée.
      const rond = document.createElementNS(SVG, "line");
      for (const [nom, valeur] of [["x1", fin.x], ["y1", fin.y], ["x2", fin.x], ["y2", fin.y]]) rond.setAttribute(nom, String(valeur));
      rond.setAttribute("class", "courbe-point");
      svg.append(rond);
    }
  }
  return svg;
}

// Le dégradé sous les courbes : défini une seule fois pour toute la page.
function degradeDesCourbes() {
  if (document.getElementById("degrade-courbe")) return;
  const defs = document.createElementNS(SVG, "svg");
  defs.setAttribute("class", "defs-courbes");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.setAttribute("aria-hidden", "true");
  const degrade = document.createElementNS(SVG, "linearGradient");
  degrade.id = "degrade-courbe";
  for (const [nom, valeur] of [["x1", "0"], ["y1", "0"], ["x2", "0"], ["y2", "1"]]) degrade.setAttribute(nom, valeur);
  for (const [offset, opacite] of [["0", "0.34"], ["1", "0"]]) {
    const arret = document.createElementNS(SVG, "stop");
    arret.setAttribute("offset", offset);
    arret.setAttribute("stop-color", "#7ea2ff");
    arret.setAttribute("stop-opacity", opacite);
    degrade.append(arret);
  }
  defs.append(degrade);
  document.body.append(defs);
}

// Une icône de la barre du bas : des traits fins dessinés (lib.js), à la couleur du texte.
function iconeSvg(id) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of traitsIcone(id)) {
    const trait = document.createElementNS(SVG, "path");
    trait.setAttribute("d", d);
    svg.append(trait);
  }
  return svg;
}

// Au premier affichage, les gros chiffres « comptent » de 0 à leur valeur ; le texte d'origine est remis exactement à la fin.
const DUREE_COMPTE_MS = 750;
function animerChiffres(racine) {
  if (sansMouvement() || !document.body.classList.contains("entree")) return;
  for (const noeud of racine.querySelectorAll(".gt-valeur, .tuile-valeur")) {
    const texte = noeud.textContent;
    const cible = entierAnimable(texte);
    if (cible === null || cible === 0) continue;
    const debut = performance.now() + 150; // après l'apparition de la tuile
    noeud.textContent = "0";
    const pas = (maintenant) => {
      const progression = (maintenant - debut) / DUREE_COMPTE_MS;
      if (progression >= 1 || !noeud.isConnected) {
        noeud.textContent = texte;
        return;
      }
      if (progression > 0) noeud.textContent = formaterNombre(valeurAnimee(cible, progression));
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }
}

// ---------- Bulle d'action : « ✅ Publié · Annuler » glisse en bas, puis s'en va toute seule ----------

const DUREE_BULLE_MS = 6000; // la même durée que la barre qui se vide (style.css)
let bulleActive = null;

function annoncer(texte, action) {
  if (bulleActive) bulleActive.retirer(true);
  const noeud = el("div", "bulle");
  noeud.setAttribute("role", "status");
  noeud.append(el("span", "bulle-texte", texte));
  let minuteur = null;
  const retirer = (vite = false) => {
    clearTimeout(minuteur);
    if (bulleActive && bulleActive.noeud === noeud) bulleActive = null;
    if (vite || sansMouvement()) {
      noeud.remove();
      return;
    }
    noeud.classList.add("sortie");
    setTimeout(() => noeud.remove(), 280);
  };
  if (action) {
    noeud.append(bouton(action.libelle, "bouton-secondaire", () => {
      retirer(true);
      action.auClic();
    }));
  }
  document.body.append(noeud);
  bulleActive = { noeud, retirer };
  minuteur = setTimeout(() => retirer(), DUREE_BULLE_MS);
}

// ---------- Glisser la carte d'un concours : à droite on publie, à gauche on refuse (les gros boutons restent) ----------

// `trouverBouton(sens)` rend le vrai bouton « Publier » / « Refuser » (ou null s'il n'est pas disponible) : glisser revient à l'appuyer.
// Si l'envoi échoue plus tard, la file d'envoi fait revenir le concours dans la pile.
function installerGlisse(carte, trouverBouton) {
  let doigt = null;
  const remettre = () => {
    carte.classList.remove("glisse");
    delete carte.dataset.glisse;
    carte.style.transform = "";
  };
  carte.addEventListener("pointerdown", (e) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || !(trouverBouton("ok") || trouverBouton("no"))) return;
    doigt = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), actif: false };
  });
  carte.addEventListener("pointermove", (e) => {
    if (!doigt || e.pointerId !== doigt.id) return;
    const dx = e.clientX - doigt.x;
    const dy = e.clientY - doigt.y;
    if (!doigt.actif) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { // geste vertical : le téléphone fait défiler la page, on s'écarte
        doigt = null;
        return;
      }
      doigt.actif = true;
      try {
        carte.setPointerCapture(e.pointerId); // le doigt peut sortir de la carte sans perdre le geste
      } catch {
        // pointeur déjà relâché : le glissement marche quand même
      }
      carte.classList.add("glisse");
    }
    carte.style.transform = `translateX(${Math.round(dx)}px) rotate(${Math.max(-12, Math.min(12, dx / 14)).toFixed(1)}deg)`;
    const sens = directionGlisse(dx, dy, GLISSE_APERCU_PX);
    if (sens && trouverBouton(sens)) carte.dataset.glisse = sens;
    else delete carte.dataset.glisse;
  });
  const lacher = (e) => {
    if (!doigt || e.pointerId !== doigt.id) return;
    const { x, y, t, actif } = doigt;
    doigt = null;
    if (!actif) return;
    const sens = e.type === "pointerup" ? decisionDeGlisse(e.clientX - x, e.clientY - y, performance.now() - t) : null;
    const cible = sens ? trouverBouton(sens) : null;
    remettre();
    if (!cible) return;
    carte.classList.add(sens === "ok" ? "envol-ok" : "envol-no");
    cible.click();
  };
  carte.addEventListener("pointerup", lacher);
  carte.addEventListener("pointercancel", lacher);
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
        await charger(true); // redessine toute la carte : le voyant du direct suit l'état réel
        return;
      }
    }
  }
}

let historiqueOrdres = []; // les derniers ordres traités (tickets fermés), pour l'accueil
let liveEnAttente = new Set(); // « couper » / « lancer » : ordres du live déjà donnés (tickets ouverts), relus à chaque affichage
const COMMANDE_VERROU_LIVE = {
  action: "verrou", libelle: "Verrouiller les commandes (urgence)",
  avertissement: "Désactive les boutons Lancer et Couper de CETTE page en ligne, tant que vous n'aurez pas supprimé le fichier commandes_live_verrouillees.txt "
    + "du dossier data_local sur le PC. L'adresse privée n'est pas touchée. À utiliser si vous pensez que quelqu'un d'autre connaît le mot de passe.",
};
const DELAI_SUIVI_ORDRE_MS = 5000;
const DUREE_SUIVI_ORDRE_MS = 150000;

// Attend la réponse du PC (ticket fermé avec un commentaire), 2 min 30 au plus ; rend son texte, ou null si le PC n'a pas répondu.
async function attendreReponseDuPc(numero) {
  const jeton = lireJetonGithub();
  if (!jeton || !depotConcours || !Number.isInteger(numero)) return null;
  const base = `https://api.github.com/repos/${depotConcours}/issues/${numero}`;
  const debut = Date.now();
  while (Date.now() - debut < DUREE_SUIVI_ORDRE_MS) {
    await pause(DELAI_SUIVI_ORDRE_MS);
    try {
      const ticket = await fetch(base, { headers: enTetesGithub(jeton), cache: "no-store" });
      if (!ticket.ok) return null;
      if ((await ticket.json()).state !== "closed") continue;
      const commentaires = await fetch(`${base}/comments?per_page=10`, { headers: enTetesGithub(jeton), cache: "no-store" });
      return commentaires.ok ? reponseDuPc(await commentaires.json(), depotConcours.split("/")[0]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Commandes du live sur la page en ligne : le bouton, la confirmation de 30 s, l'ordre part à GitHub, le PC (allumé) l'exécute dans la minute.
function dessinerCommandesEnLigne(zone, enCours, maintenant) {
  const commande = commandeLiveEnLigne(enCours);
  const entete = el("div", "fp-entete");
  entete.append(el("strong", "", "Commandes"), el("span", "badge-compteur", "En ligne, via GitHub"));
  const message = el("p", "cmd-message");
  message.setAttribute("role", "status");
  if (dernierResultat) {
    ecrireMessage(message, dernierResultat.texte, dernierResultat.reussi ? "ok" : "erreur");
    dernierResultat = null;
  }
  const emplacement = el("div", "cmd-emplacement");
  zone.replaceChildren(entete, message, emplacement);
  const genere = chargeEnLigne && chargeEnLigne.paquet ? chargeEnLigne.paquet.genere_a : null;
  emplacement.append(el("p", "discret", `Le PC (allumé) exécute l'ordre dans la minute. État du direct d'après le relevé ${genere ? ageLisible(genere, maintenant) : "(date inconnue)"}.`));
  if (chargeEnLigne && chargeEnLigne.commandes_live_verrouillees === true) {
    emplacement.append(el("p", "alerte alerte-avertissement",
      "Commandes du live en ligne verrouillées. Pour les rouvrir, supprimez le fichier commandes_live_verrouillees.txt du dossier data_local sur le PC. L'adresse privée garde ses boutons."));
    return;
  }
  if (liveEnAttente.size > 0) {
    emplacement.append(el("p", "alerte alerte-avertissement", `Ordre déjà donné (${[...liveEnAttente].join(", ")}) : le PC l'exécute dans la minute.`));
    return;
  }
  if (!commande) {
    emplacement.append(el("p", "discret", "L'état du direct est inconnu : commandes désactivées."));
    const verrouSeul = bouton(COMMANDE_VERROU_LIVE.libelle, "bouton-secondaire", () => demander(COMMANDE_VERROU_LIVE, verrouSeul));
    emplacement.append(verrouSeul);
    return;
  }
  const principal = bouton(commande.libelle, commande.danger ? "bouton-danger" : "bouton-principal", () => demander(commande, principal));
  emplacement.append(principal);
  const verrou = bouton(COMMANDE_VERROU_LIVE.libelle, "bouton-secondaire", () => demander(COMMANDE_VERROU_LIVE, verrou));
  emplacement.append(verrou);

  function demander(commande, principal) {
    principal.disabled = true;
    let restant = 30;
    const compte = el("p", "discret cmd-compte", `Expire dans ${restant} s`);
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
        principal.disabled = false;
        ecrireMessage(message, "Confirmation expirée : recommencez.", "erreur");
      } else {
        compte.textContent = `Expire dans ${restant} s`;
      }
    }, 1000);
    const confirmer = bouton("Confirmer", "bouton-danger", async () => {
      confirmer.disabled = true;
      const reponse = await envoyerOrdreLive(commande.action);
      fermer();
      if (!reponse.ok) {
        ecrireMessage(message, reponse.json && reponse.json.erreur ? reponse.json.erreur : "Commande impossible.", "erreur");
        principal.disabled = false;
        return;
      }
      liveEnAttente.add(commande.action);
      emplacement.replaceChildren(el("p", "alerte alerte-avertissement", "Ordre envoyé : le PC l'exécute dans la minute."));
      ecrireMessage(message, "J'attends la réponse du PC…", "info");
      const texte = await attendreReponseDuPc(reponse.json.numero);
      dernierResultat = texte
        ? { texte, reussi: /^(Exécuté|Verrouillé)/.test(texte) }
        : { texte: "Pas de réponse du PC pour l'instant (est-il allumé ?). Sans réponse dans les 10 minutes, l'ordre sera ignoré.", reussi: false };
      await charger(true);
    });
    const annuler = bouton("Annuler", "bouton-secondaire", () => {
      fermer();
      principal.disabled = false;
      ecrireMessage(message, "Annulé.", "info");
    });
    panneau.setAttribute("role", "group");
    panneau.setAttribute("aria-label", "Confirmation");
    panneau.append(el("p", "cmd-titre", `${commande.libelle} ?`), el("p", "cmd-avertissement", commande.avertissement), compte, groupeDeLiens("cmd-actions", confirmer, annuler));
    emplacement.append(panneau);
  }
}

async function initialiserCommandes(zone, projetId, enCours) {
  if (EN_LIGNE) {
    // Pas de serveur en ligne : il faut la clé GitHub des ordres (sans elle, rien à montrer).
    if (!decisionsDisponibles || !depotConcours) return;
    zone.hidden = false;
    dessinerCommandesEnLigne(zone, enCours, new Date());
    return;
  }
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

  const alerteLive = alertesFalling(d, maintenant).find((a) => a.niveau === "erreur"); // seule une vraie panne est montrée, sur une ligne
  if (alerteLive) carte.append(el("p", `alerte alerte-${alerteLive.niveau}`, alerteLive.texte));

  const zoneCommandes = el("section", "fp-commandes");
  zoneCommandes.hidden = true; // montrée seulement si le serveur privé propose des commandes
  carte.append(zoneCommandes);
  initialiserCommandes(zoneCommandes, projet.id, live.en_cours).catch(() => {});

  const chiffres = el("div", "grosses-tuiles");
  const depuisBilan = (valeur, precedent) => {
    const v = variation(valeur, precedent);
    return v.sens === "inconnu" ? "" : v.texte;
  };
  chiffres.append(
    grosseTuile({ ton: "success", valeur: formaterNombre(chaine.abonnes), libelle: "abonnés", detail: depuisBilan(chaine.abonnes, chaine.abonnes_veille) }, "👥"),
    grosseTuile({ ton: "accent", valeur: formaterNombre(chaine.vues), libelle: "vues", detail: depuisBilan(chaine.vues, chaine.vues_veille) }, "👀"),
  );
  carte.append(chiffres, el("p", "discret", `${formaterNombre(chaine.videos)} vidéos sur la chaîne`));
  const ages = el("p", "discret fp-ages");
  const majAbonnes = chaine.maj_abonnes ? ageLisible(chaine.maj_abonnes, maintenant) : "date inconnue";
  ages.append(`Mis à jour ${majAbonnes}`);
  const courbes = el("div", "fp-courbes");
  courbes.append(blocCourbe("Abonnés", courbe, "abonnes"), blocCourbe("Vues", courbe, "vues"));

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
const FORMAT_HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" });

// L'heure de Paris, de 0 à 23 (NaN si elle est illisible : la salutation retombe sur « Bonjour »).
function heureDeParis(date) {
  const heure = FORMAT_HEURE_PARIS.formatToParts(date).find((p) => p.type === "hour");
  return heure ? Number(heure.value) : NaN;
}
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

// Seules les alertes qui demandent un geste ou signalent une panne sont montrées (deux lignes au plus) : le reste est du bruit.
// La pile de concours dit déjà combien il en reste à décider.
function alertesUtiles(alertes, max = 2) {
  return trierAlertes(alertes).filter((a) => ["erreur", "avertissement", "action"].includes(a.niveau) && !estRappelDeDecision(a.texte)).slice(0, max);
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

// Crée le ticket d'un ordre (le bot ou le PC le lira) ; { ok, json } comme la réponse du serveur privé, pour que la même interface serve aux deux.
// Pas de doublon : si un ticket ouvert porte l'un des titres de `enConflit`, l'ordre est refusé avec `messageDoublon`.
async function creerTicketGithub(titre, enConflit, messageDoublon) {
  const jeton = lireJetonGithub();
  if (!jeton) return { ok: false, json: { erreur: "Aucune clé GitHub n'est enregistrée sur cet appareil." } };
  if (!depotConcours) return { ok: false, json: { erreur: "Le dépôt du bot est inconnu : actualise la page." } };
  const base = `https://api.github.com/repos/${depotConcours}/issues`;
  try {
    const liste = await fetch(`${base}?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (!liste.ok) return { ok: false, json: { erreur: messageErreurGithub(liste.status) } };
    const tickets = await liste.json();
    if (Array.isArray(tickets) && tickets.some((t) => t && enConflit.includes(t.title))) return { ok: false, json: { erreur: messageDoublon } };
    const reponse = await fetch(base, {
      method: "POST", headers: { ...enTetesGithub(jeton), "Content-Type": "application/json" },
      body: JSON.stringify({ title: titre, body: "Ordre donné depuis la page en ligne du tableau de bord." }),
    });
    if (reponse.status !== 201) return { ok: false, json: { erreur: messageErreurGithub(reponse.status) } };
    let numero = null;
    try {
      numero = (await reponse.json()).number;
    } catch {
      // le numéro sert seulement à suivre la réponse du PC
    }
    return { ok: true, json: { statut: "envoye", numero } };
  } catch {
    return { ok: false, json: { erreur: "GitHub est injoignable : réessaie dans un moment." } };
  }
}

async function envoyerOrdreGithub(action, code) {
  if ((action !== "ok" && action !== "no") || !/^[0-9a-f]{10}$/.test(code)) return { ok: false, json: { erreur: "Décision invalide." } };
  return creerTicketGithub(`${action}_${code}`, [`ok_${code}`, `no_${code}`],
    "Un ordre est déjà en attente pour cette carte : le bot l'applique à son prochain passage.");
}

async function envoyerOrdreLive(action) {
  const titre = titreOrdreLive(action);
  if (titre === null) return { ok: false, json: { erreur: "Commande invalide." } };
  return creerTicketGithub(titre, ["live_couper", "live_lancer"],
    "Un ordre du live est déjà en attente : le PC l'exécute dans la minute (il doit être allumé).");
}

// Les ordres déjà donnés et pas encore appliqués (tickets ouverts) : les cartes concernées l'indiquent, même après un rechargement.
async function lireOrdresEnAttenteGithub() {
  const jeton = lireJetonGithub();
  if (!jeton || !depotConcours) return;
  try {
    const reponse = await fetch(`https://api.github.com/repos/${depotConcours}/issues?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (!reponse.ok) return;
    const tickets = await reponse.json();
    liveEnAttente = new Set(actionsLiveEnAttente(tickets));
    for (const t of Array.isArray(tickets) ? tickets : []) {
      const trouve = t && typeof t.title === "string" ? /^(ok|no)_([0-9a-f]{10})$/.exec(t.title) : null;
      if (trouve) {
        ordresEnvoyes.set(trouve[2], trouve[1]);
        if (Number.isInteger(t.number)) numerosOrdres.set(trouve[2], t.number);
      }
    }
    const fermes = await fetch(
      `https://api.github.com/repos/${depotConcours}/issues?state=closed&creator=${encodeURIComponent(depotConcours.split("/")[0])}&per_page=30&sort=updated&direction=desc`,
      { headers: enTetesGithub(jeton), cache: "no-store" },
    );
    if (fermes.ok) historiqueOrdres = historiqueDesOrdres(await fermes.json(), 10);
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
    await charger(true);
  });
  const oublier = bouton("Oublier la clé", "bouton-secondaire", async () => {
    oublierStockage(CLE_JETON_GITHUB);
    ordresEnvoyes.clear();
    await charger(true);
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

// ---------- Tri rapide : ✅ / ❌ font passer au concours suivant TOUT DE SUITE ; les décisions partent en fond, une par une ----------
// La file est gardée dans le téléphone : une page fermée trop tôt reprend l'envoi à sa prochaine ouverture. Pendant 2,5 s, « Annuler »
// retire la décision avant qu'elle parte ; après, sur la page en ligne, il ferme le ticket tant que le bot ne l'a pas lu.

const CLE_FILE_ENVOI = "tableau.decisions_a_envoyer";
let fileEnvoi = lireFileGardee();
let envoiEnVol = null; // { code, action, titre, annule } : la décision en train de partir
let minuteurEnvoi = null;
let majPile = { tout: () => {}, compteur: () => {} }; // rebranché par la pile affichée : tout redessiner, ou seulement le compteur d'envois
let raccourcisPile = null; // { visible(), ok(), no(), passer() } : ce que font les flèches du clavier sur la pile affichée

function lireFileGardee() {
  try {
    return fileEnvoiValide(JSON.parse(lireStockage(CLE_FILE_ENVOI) ?? "[]"));
  } catch {
    return [];
  }
}

function sauverFile() {
  const aGarder = envoiEnVol ? [envoiEnVol, ...fileEnvoi] : fileEnvoi; // celle qui part reste gardée tant qu'elle n'est pas arrivée
  if (aGarder.length === 0) oublierStockage(CLE_FILE_ENVOI);
  else ecrireStockage(CLE_FILE_ENVOI, JSON.stringify(aGarder.map(({ code, action, titre, pret }) => ({ code, action, titre, pret }))));
}

// Les concours décidés ici mais pas encore arrivés : la pile les cache déjà.
function codesEnEnvoi() {
  const codes = new Set(fileEnvoi.map((e) => e.code));
  if (envoiEnVol) codes.add(envoiEnVol.code);
  return codes;
}

function actionEnEnvoi(code) {
  if (envoiEnVol && envoiEnVol.code === code) return envoiEnVol.action;
  const entree = fileEnvoi.find((e) => e.code === code);
  return entree ? entree.action : undefined;
}

function decider(code, action, titre) {
  fileEnvoi = ajouterDecision(fileEnvoi, code, action, titre, Date.now());
  sauverFile();
  majPile.compteur();
  planifierEnvoi();
}

function planifierEnvoi() {
  clearTimeout(minuteurEnvoi);
  minuteurEnvoi = null;
  if (envoiEnVol || !decisionsDisponibles) return;
  const avant = fileEnvoi.length;
  fileEnvoi = fileEnvoi.filter((e) => !ordresEnvoyes.has(e.code)); // déjà arrivé (vu sur GitHub au rechargement) : rien à renvoyer
  if (fileEnvoi.length !== avant) sauverFile();
  const { entree, attenteMs } = prochainEnvoi(fileEnvoi, Date.now());
  if (entree) envoyerDecision(entree);
  else if (attenteMs !== null) minuteurEnvoi = setTimeout(planifierEnvoi, attenteMs);
}

// Un ordre du tri : page du PC, le serveur donne un jeton de 30 s, rendu aussitôt ; page en ligne, un ticket GitHub.
async function envoyerOrdreConcours(action, code) {
  if (EN_LIGNE) return envoyerOrdreGithub(action, code);
  const demande = await poster("api/concours/demander", { action, code });
  if (!demande.ok) return demande;
  return poster("api/concours/confirmer", { jeton: demande.json ? demande.json.jeton : null });
}

async function envoyerDecision(entree) {
  envoiEnVol = entree;
  fileEnvoi = retirerDecision(fileEnvoi, entree.code);
  confirmationsOuvertes += 1; // la page ne se rafraîchit pas toute seule pendant l'envoi
  let reponse;
  try {
    reponse = await envoyerOrdreConcours(entree.action, entree.code);
  } catch {
    reponse = { ok: false, json: { erreur: "Envoi impossible pour le moment." } };
  } finally {
    confirmationsOuvertes -= 1;
  }
  envoiEnVol = null;
  if (reponse.ok) {
    ordresEnvoyes.set(entree.code, entree.action);
    if (reponse.json && Number.isInteger(reponse.json.numero)) numerosOrdres.set(entree.code, reponse.json.numero);
  }
  sauverFile();
  if (!reponse.ok) {
    const erreur = reponse.json && reponse.json.erreur ? reponse.json.erreur : "Décision impossible.";
    annoncer(`⚠️ Pas envoyé (${abreger(entree.titre || "un concours", 30)}) : ${erreur} Il revient dans la pile.`);
    majPile.tout();
  } else if (entree.annule) {
    await annulerApresEnvoi(entree.code);
  } else {
    majPile.compteur();
  }
  // GitHub refuse les tickets trop rapprochés : petite pause entre deux envois en ligne ; après un échec, on souffle un peu.
  minuteurEnvoi = setTimeout(planifierEnvoi, !reponse.ok ? 3000 : EN_LIGNE ? PAUSE_ENTRE_ORDRES_MS : 0);
}

async function annulerApresEnvoi(code) {
  if (EN_LIGNE && numerosOrdres.has(code)) {
    const reprise = await reprendreDecision(code);
    annoncer(reprise.ok ? "Annulé : le concours revient." : reprise.erreur);
  } else {
    annoncer("Trop tard : la décision était déjà partie vers le bot.");
  }
  majPile.tout();
}

// « Annuler » de la bulle : pas encore partie, on la retire ; en route, on la reprend dès qu'elle arrive ; partie, on ferme son ticket (en ligne).
async function annulerDecision(code) {
  if (fileEnvoi.some((e) => e.code === code)) {
    fileEnvoi = retirerDecision(fileEnvoi, code);
    sauverFile();
    annoncer("Annulé : le concours revient.");
    majPile.tout();
    planifierEnvoi();
    return;
  }
  if (envoiEnVol && envoiEnVol.code === code) {
    envoiEnVol.annule = true;
    annoncer("Annulation en cours…");
    return;
  }
  await annulerApresEnvoi(code);
}

function annulerLot(codes) {
  const avant = fileEnvoi.length;
  fileEnvoi = fileEnvoi.filter((e) => !codes.includes(e.code));
  const annules = avant - fileEnvoi.length;
  sauverFile();
  majPile.tout();
  planifierEnvoi();
  const partis = codes.length - annules;
  annoncer(partis > 0 ? `${annules} refus annulés, ${partis} déjà partis.` : `${annules} refus annulés : ils reviennent dans la pile.`);
}

// Au clavier (ordinateur) : → publier, ← refuser, ↓ passer, quand la rubrique Concours est affichée.
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || !raccourcisPile || !raccourcisPile.visible()) return;
  const cible = e.target;
  const dansUnChamp = cible instanceof HTMLElement && (cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName));
  const geste = toucheDeTri({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, dansUnChamp });
  if (!geste || typeof raccourcisPile[geste] !== "function") return;
  e.preventDefault();
  raccourcisPile[geste]();
});

const reportesConcours = []; // codes passés « pour plus tard » : renvoyés au bout de la pile (jusqu'au rechargement de la page)
let filtreConcours = {}; // { plateforme, urgent } : ce que la pile montre
const numerosOrdres = new Map(); // code de carte -> numéro du ticket de son ordre (page en ligne) : pour reprendre une décision
const PAUSE_ENTRE_ORDRES_MS = 1200; // GitHub limite les créations de tickets trop rapprochées

// Reprendre une décision pas encore appliquée : on ferme son ticket, le bot ne le verra plus. Trop tard si le bot l'a déjà fermé.
async function reprendreDecision(code) {
  const jeton = lireJetonGithub();
  const numero = numerosOrdres.get(code);
  if (!jeton || !depotConcours || !Number.isInteger(numero)) return { ok: false, erreur: "Impossible de reprendre cette décision d'ici." };
  const base = `https://api.github.com/repos/${depotConcours}/issues/${numero}`;
  try {
    const ticket = await fetch(base, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (!ticket.ok) return { ok: false, erreur: messageErreurGithub(ticket.status) };
    if ((await ticket.json()).state !== "open") return { ok: false, erreur: "Trop tard : le bot a déjà appliqué cette décision." };
    const reponse = await fetch(base, {
      method: "PATCH", headers: { ...enTetesGithub(jeton), "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed", state_reason: "not_planned" }),
    });
    if (!reponse.ok) return { ok: false, erreur: messageErreurGithub(reponse.status) };
  } catch {
    return { ok: false, erreur: "GitHub est injoignable : réessaie dans un moment." };
  }
  ordresEnvoyes.delete(code);
  numerosOrdres.delete(code);
  return { ok: true };
}

// Les concours à décider, un par un : le lot en grand, deux gros boutons (ou glisser la carte, ou les flèches du clavier), « Passer » pour
// y revenir plus tard, des filtres (plateforme, fin proche) et un refus en lot. Décider fait passer au suivant tout de suite (envoi en fond).
function pileConcours(cartes, maintenant) {
  const zone = el("section", "pile");
  zone.setAttribute("aria-label", "Concours à décider");
  let panneauLot = false; // le panneau « Refuser en lot » est-il ouvert ?
  const filtreActif = () => Boolean(filtreConcours.plateforme) || filtreConcours.urgent === true;
  const badgeEnvoi = el("span", "badge-envoi");
  badgeEnvoi.setAttribute("role", "status");
  const majCompteur = () => {
    const n = codesEnEnvoi().size;
    badgeEnvoi.textContent = n > 0 ? `⏳ ${n} en envoi` : "";
    badgeEnvoi.hidden = n === 0;
  };
  majPile = { tout: () => dessiner(), compteur: majCompteur };

  function puce(libelle, actif, auClic) {
    const b = el("button", actif ? "puce puce-active" : "puce", libelle);
    b.type = "button";
    b.setAttribute("aria-pressed", String(actif));
    b.addEventListener("click", auClic);
    return b;
  }

  function panneauDeLots(groupes, titres) {
    const panneau = el("div", "pile-lots");
    const choisir = () => {
      panneau.replaceChildren(el("p", "cmd-titre", "Refuser en lot"), ...groupes.map((g) => bouton(g.libelle, "bouton-secondaire", () => confirmer(g))),
        bouton("Fermer", "bouton-secondaire", () => {
          panneauLot = false;
          dessiner();
        }));
    };
    const confirmer = (groupe) => {
      const n = groupe.codes.length;
      confirmationsOuvertes += 1; // la page ne se rafraîchit pas toute seule pendant la confirmation
      let ferme = false;
      const fermer = () => {
        if (ferme) return;
        ferme = true;
        confirmationsOuvertes -= 1;
      };
      const oui = bouton("Confirmer", "bouton-danger", () => {
        fermer();
        for (const code of groupe.codes) decider(code, "no", titres.get(code) ?? "");
        panneauLot = false;
        annoncer(`❌ ${n} refus : ils partent en fond.`, { libelle: "Annuler", auClic: () => annulerLot(groupe.codes) });
        dessiner();
      });
      const non = bouton("Annuler", "bouton-secondaire", () => {
        fermer();
        choisir();
      });
      panneau.replaceChildren(
        el("p", "cmd-titre", `Refuser ${n} concours ?`),
        el("p", "cmd-avertissement", `${groupe.libelle} · ils partent en fond, tu peux continuer`),
        groupeDeLiens("cmd-actions", oui, non),
      );
    };
    choisir();
    return panneau;
  }

  function dessiner() {
    const options = { maintenant, masques: new Set([...ordresEnvoyes.keys(), ...codesEnEnvoi()]), reportes: reportesConcours };
    const toute = pileDeConcours(cartes, options);
    const pile = pileDeConcours(cartes, { ...options, filtre: filtreConcours });
    const entete = el("div", "pile-entete");
    majCompteur();
    entete.append(
      el("h3", "", "À décider"),
      badgeEnvoi,
      toute.length > 0 ? el("span", "badge-compteur", filtreActif() ? `${pile.length} sur ${toute.length}` : `${toute.length} à décider`) : el("span", "badge-ok", "Tout est décidé"),
    );
    const noeuds = [entete];
    raccourcisPile = null;
    if (toute.length === 0) {
      noeuds.push(el("p", "discret pile-vide", "Tout est décidé ✓"));
      zone.replaceChildren(...noeuds);
      return;
    }
    const plateformes = plateformesDeLaPile(cartes, maintenant, options.masques);
    const finProche = toute.some((x) => libelleFin(x.fin, maintenant).urgent);
    if (plateformes.length >= 2 || finProche || filtreActif()) {
      const filtres = el("div", "filtres");
      filtres.append(puce("Tout", !filtreActif(), () => {
        filtreConcours = {};
        dessiner();
      }));
      if (plateformes.length >= 2 || filtreConcours.plateforme) {
        for (const p of plateformes) {
          filtres.append(puce(`${p.nom} (${p.n})`, filtreConcours.plateforme === p.nom, () => {
            filtreConcours = { ...filtreConcours, plateforme: filtreConcours.plateforme === p.nom ? null : p.nom };
            dessiner();
          }));
        }
      }
      if (finProche || filtreConcours.urgent === true) {
        filtres.append(puce("Fin proche", filtreConcours.urgent === true, () => {
          filtreConcours = { ...filtreConcours, urgent: !filtreConcours.urgent };
          dessiner();
        }));
      }
      noeuds.push(filtres);
    }
    if (pile.length === 0) {
      noeuds.push(el("p", "discret pile-vide", "Aucun concours ne correspond à ce filtre."));
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

    // Décider : la décision part en fond, la carte s'envole et la suivante arrive tout de suite.
    let tranche = false;
    const trancher = (action) => {
      if (tranche || !decisionsDisponibles) return;
      tranche = true;
      decider(c.code, action, p.titre);
      annoncer(`${action === "ok" ? "✅ Publié" : "❌ Refusé"} : ${abreger(p.titre, 45)}`, { libelle: "Annuler", auClic: () => annulerDecision(c.code) });
      if (sansMouvement()) {
        dessiner();
        return;
      }
      grande.classList.add(action === "ok" ? "envol-ok" : "envol-no");
      setTimeout(dessiner, 180);
    };
    const passer = () => {
      const deja = reportesConcours.indexOf(c.code);
      if (deja >= 0) reportesConcours.splice(deja, 1);
      reportesConcours.push(c.code);
      dessiner();
    };
    if (decisionsDisponibles) {
      const boutons = el("div", "cc-boutons cc-boutons-grands");
      boutons.append(
        bouton("❌ Refuser", "bouton-grand bouton-refuser", () => trancher("no")),
        bouton("✅ Publier", "bouton-grand bouton-publier", () => trancher("ok")),
      );
      noeuds.push(boutons);
      installerGlisse(grande, (sens) => zone.querySelector(sens === "ok" ? ".bouton-publier" : ".bouton-refuser"));
    } else {
      noeuds.push(el("p", "discret", EN_LIGNE
        ? "Pour décider ici, enregistre une clé GitHub (section plus bas) ; sinon réponds dans Telegram."
        : "Lecture seule : les boutons n'existent que sur le tableau privé."));
    }
    if (pile.length > 1) noeuds.push(bouton("Passer pour plus tard", "bouton-secondaire pile-passer", passer));
    if (decisionsDisponibles) {
      noeuds.push(el("p", "discret pile-astuce", "Clavier : ← refuser · → publier · ↓ passer"));
      const groupes = groupesDeRefus(toute, maintenant);
      if (groupes.length > 0) {
        const titres = new Map(toute.map((x) => [x.code, presenterConcours(x, maintenant).titre]));
        noeuds.push(panneauLot ? panneauDeLots(groupes, titres) : bouton("Refuser en lot…", "bouton-secondaire pile-lot", () => {
          panneauLot = true;
          dessiner();
        }));
      }
    }
    zone.replaceChildren(...noeuds);
    raccourcisPile = {
      visible: () => zone.isConnected && !zone.closest("[hidden]"),
      ok: () => trancher("ok"),
      no: () => trancher("no"),
      passer: pile.length > 1 ? passer : null,
    };
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

  const alertes = liste(d.a_faire);
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", String(projet.nom ?? "Concours Gratuits FR")));
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger(true)));
  carte.append(entete);

  // Les vidéos de demain dans le groupe Telegram : une ligne d'état (les problèmes sont dits plus bas, avec les alertes) et un appui pour ouvrir chaque groupe.
  const videosDeDemain = ligneVideosDeDemain(d.videos_du_jour);
  const groupes = liensDesGroupes(groupesTelegramDe([projet], "concours"));
  if (videosDeDemain) carte.append(el("p", videosDeDemain.ton === "ok" ? "texte-ok" : "discret", `${videosDeDemain.ton === "ok" ? "✅" : "⏳"} ${videosDeDemain.texte}`));
  if (groupes.length > 0) carte.append(groupeDeLiens("fp-acces", ...groupes));

  const outils = groupeDeLiens(
    "fp-acces",
    lien("Canal Telegram", lienPlateforme(canal ? canal.lien : null), "lien lien-principal"),
    lien("Passages du bot (GitHub)", lienPlateforme(liens.actions)),
    lien("Dépôt du bot", lienPlateforme(liens.depot)),
  );
  const importantes = alertesUtiles(alertes);
  if (importantes.length > 0) carte.append(blocAlertes(importantes));

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

  const enEnvoi = codesEnEnvoi();
  const enAttente = cartes.filter((c) => c.approuve === true || c.ordre === "ok" || c.ordre === "no" || ordresEnvoyes.has(c.code) || enEnvoi.has(c.code));
  if (enAttente.length > 0) {
    plus.push(sectionFp(`Décidés, en attente du bot (${enAttente.length})`, false, listeFp(enAttente.map((c) => {
      if (!ordresEnvoyes.has(c.code) && enEnvoi.has(c.code) && c.ordre !== "ok" && c.ordre !== "no") {
        return ligneFp(presenterConcours(c, maintenant).titre, `${libelleOrdre(actionEnEnvoi(c.code)) ?? "Décidé"} · envoi en cours`);
      }
      const ordre = c.ordre === "ok" || c.ordre === "no" ? c.ordre : ordresEnvoyes.get(c.code);
      const reprendre = EN_LIGNE && numerosOrdres.has(c.code)
        ? groupeDeLiens("fp-liens", bouton("Reprendre", "bouton-secondaire", async () => {
          const reprise = await reprendreDecision(c.code);
          annoncer(reprise.ok ? "Décision annulée : le concours revient dans la pile." : reprise.erreur);
          await charger(true);
        }))
        : null;
      return ligneFp(presenterConcours(c, maintenant).titre, libelleOrdre(ordre) ?? "Accepté : publication au prochain passage", reprendre);
    }), "")));
  }
  const reste = Number(compteurs.cartes) - cartes.length;
  if (reste > 0) plus.push(el("p", "discret", `${formaterNombre(reste)} autre(s) carte(s) non affichée(s).`));

  // Sans clé GitHub, les boutons de la page en ligne ne marchent pas : la section reste visible. Avec la clé, elle se range dans les détails.
  if (EN_LIGNE && !lireJetonGithub()) carte.append(sectionCleGithub());
  else if (EN_LIGNE) plus.push(sectionCleGithub());
  const bilan = statsConcours(d, maintenant);
  const enumerer = (elements) => (elements.length > 0 ? elements.map((e) => `${e.nom} ${e.n}`).join(" · ") : "aucun");
  plus.push(sectionFp("Statistiques", false, listeFp([
    ligneFp("À décider", `${bilan.aDecider}${bilan.termines > 0 ? ` (dont ${bilan.termines} terminés)` : ""} · ${enumerer(bilan.parPlateformeADecider)}`),
    ligneFp(`Derniers publiés (${bilan.publiesRecents})`, enumerer(bilan.publiesParPlateforme)),
    ligneFp("Publiés", [
      bilan.publies7j !== null ? `${bilan.publies7j} sur 7 jours` : null,
      bilan.publiesTotal !== null ? `${bilan.publiesTotal} au total` : null,
      bilan.refus !== null ? `${bilan.refus} refusés` : null,
    ].filter(Boolean).join(" · ") || "inconnu"),
  ], "")));
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
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger(true)));
  carte.append(entete);
  carte.append(groupeDeLiens(
    "fp-acces",
    lien("Gumroad : mes produits", "https://app.gumroad.com/products", "lien lien-principal"),
    lien("TikTok Studio : publier", "https://www.tiktok.com/tiktokstudio/upload"),
    lien("TikTok Studio : contenu", "https://www.tiktok.com/tiktokstudio/content"),
  ));
  const importantes = alertesUtiles(liste(d.a_faire));
  if (importantes.length > 0) carte.append(blocAlertes(importantes));

  const chiffres = el("div", "fp-chiffres");
  chiffres.append(
    tuileNombre("Produits à publier", compteurs.a_publier, `${formaterNombre(compteurs.deja_publies)} déjà publié(s)`),
    tuileTexte("Vidéos publiées", `${formaterNombre(compteurs.videos_faites)} / ${formaterNombre(compteurs.videos_prevues)}`),
    tuileTexte("Prochaine publication", prochaine && prochaine.quand ? delaiAvant(prochaine.quand, maintenant) : "aucune", prochaine && prochaine.quand ? rendezVous(prochaine) : ""),
    tuileNombre("Vidéos en réserve", compteurs.reserve),
  );
  carte.append(chiffres);

  const groupe = (titre, ouvert, entrees) => sectionFp(
    `${titre} (${entrees.length})`, ouvert && entrees.length > 0,
    listeFp(entrees.slice(0, 30).map(ligneCalendrier), "Rien ici."),
    ...(entrees.length > 30 ? [el("p", "discret", `${entrees.length - 30} autre(s) non affichée(s).`)] : []),
  );
  // Ce qui est à faire bientôt d'abord. Les vidéos en retard ne sont plus montrées (19/11/2026 : « enlève les vidéos en retard »).
  carte.append(
    groupe("Aujourd'hui", true, calendrier.aujourdhui),
    groupe("À venir", true, calendrier.aVenir),
    groupe("Déjà fait", false, calendrier.faits),
    groupe("En réserve", false, calendrier.reserve),
  );
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
  entete.append(bouton("Actualiser", "bouton-secondaire", () => charger(true)));
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

// ---------- TikTok : chaque compte dans le projet auquel il appartient (plus d'onglet à part) ----------

function ligneVideoTiktok(v, maintenant) {
  return ligneFp(
    abreger(v.titre, 90),
    [`@${String(v.compte)}`, compter(v.vues, "vue", "vues"), compter(v.likes, "like", "likes"), compter(v.commentaires, "commentaire", "commentaires"),
      compter(v.partages, "partage", "partages"), typeof v.publie_le === "string" ? `publiée ${ageLisible(v.publie_le, maintenant)}` : null]
      .filter((x) => typeof x === "string" && x !== "?" && x !== "@undefined").join(" · "),
    groupeDeLiens("fp-liens", lien("Voir", lienTiktok(v.lien))),
  );
}

function ligneExportTiktok(v) {
  return ligneFp(
    abreger(v.titre, 90),
    [compter(v.vues, "vue", "vues"), compter(v.likes, "like", "likes"), compter(v.commentaires, "commentaire", "commentaires"),
      compter(v.partages, "partage", "partages"), typeof v.date === "string" ? v.date : null].filter((x) => typeof x === "string" && x !== "?").join(" · "),
    groupeDeLiens("fp-liens", lien("Voir", lienTiktok(v.lien))),
  );
}

// Le palmarès : les 3 premières vidéos en vue, les suivantes dans une section repliée.
function palmaresTiktok(titre, videos, ligneDe, vide) {
  const reste = videos.length > 3 ? [sectionFp(`Voir les ${videos.length - 3} autres`, false, listeFp(videos.slice(3).map(ligneDe), ""))] : [];
  return sectionFp(`${titre} (${videos.length})`, true, listeFp(videos.slice(0, 3).map(ligneDe), vide), ...reste);
}

// Un compte TikTok, dans l'onglet de son projet : deux gros chiffres et ce qu'il y a à faire, rien d'autre en vue ; le reste est sous « Voir plus ».
// `general` : le premier bloc de la page porte aussi ce qui ne parle d'aucun compte (exports de TikTok Studio, rappel d'export, liens).
function blocTiktok(projet, compte, general, maintenant) {
  const d = objet(projet.details);
  const exports = objet(d.exports);
  const publiques = objet(d.videos_publiques);
  const nom = String(compte.compte);
  const carte = el("article", "carte carte-large carte-tiktok");
  const icone = el("span", "titre-icone");
  icone.append(iconeSvg("tiktok"));
  const entete = el("div", "fp-entete");
  entete.append(icone, el("h3", "", `TikTok @${nom}`));
  carte.append(entete);

  const v = variation(compte.abonnes, Number.isFinite(compte.variation) ? compte.abonnes - compte.variation : null);
  const depuis = typeof compte.variation_depuis === "string" ? `${compte.variation_depuis.slice(8, 10)}/${compte.variation_depuis.slice(5, 7)}` : "?";
  const tuiles = el("div", "grosses-tuiles");
  tuiles.append(
    grosseTuile({ ton: "success", valeur: formaterNombre(compte.abonnes), libelle: "abonnés", detail: v.sens === "inconnu" ? "" : `${v.texte} depuis le ${depuis}` }, "👥"),
    grosseTuile({ ton: "accent", valeur: formaterNombre(compte.vues_total), libelle: "vues" }, "👀"),
  );
  carte.append(tuiles);

  const rappels = [...rappelsDuCompte(d.a_faire, nom), ...(general ? rappelsGenerauxTiktok(d.a_faire) : [])].slice(0, 2);
  for (const r of rappels) carte.append(el("p", `alerte alerte-${r.niveau}`, abreger(r.texte, 80)));
  if (agendaPresent && rappels.length > 0) carte.append(bouton("📅 Ouvrir l'agenda", "bouton-secondaire agenda-raccourci", () => allerVersOnglet("publier")));

  const plus = [];
  plus.push(el("p", "discret", `${formaterNombre(compte.jaime)} j'aime · ${formaterNombre(compte.videos)} vidéos`));
  const courbes = [];
  if (liste(compte.courbe).length >= 2) courbes.push(blocCourbe("Abonnés", liste(compte.courbe), "valeur"));
  if (liste(compte.courbe_vues).length >= 2) courbes.push(blocCourbe("Vues", liste(compte.courbe_vues), "valeur"));
  if (courbes.length > 0) plus.push(sectionFp("Évolution", false, ...courbes));
  if (Number(publiques.suivies) > 0) {
    plus.push(palmaresTiktok("Vidéos les plus vues", videosDuCompte(publiques.liste, nom), (x) => ligneVideoTiktok(x, maintenant),
      Number(publiques.lues) === 0 ? "Première lecture en cours : revenez dans une minute." : "Aucune vidéo lisible."));
  }
  if (general) {
    if (Number(publiques.suivies) > 0) {
      plus.push(el("p", "discret", `Lecture publique, sans connexion : ${publiques.lues ?? 0} vidéo(s) lue(s) sur ${publiques.suivies} suivies`
        + `${typeof publiques.maj === "string" ? `, dernière lecture ${ageLisible(publiques.maj, maintenant)}` : ""}. Chaque vidéo est relue toutes les 6 heures.`));
    }
    if (Number(exports.nb_videos) > 0) {
      const tuilesExport = el("div", "grosses-tuiles");
      tuilesExport.append(grosseTuile({ ton: "accent", valeur: formaterNombre(exports.total_vues), libelle: "vues (exports)", detail: `${formaterNombre(exports.nb_videos)} vidéos suivies` }, "👀"));
      plus.push(tuilesExport, palmaresTiktok("Vidéos les plus vues (exports)", liste(exports.videos), ligneExportTiktok, "Aucune vidéo dans les exports."));
    }
    const serieExport = liste(exports.serie_jours).filter((p) => typeof p.date === "string" && Number.isFinite(p.vues));
    if (serieExport.length >= 2) {
      plus.push(sectionFp(
        `Vues par jour, export de TikTok Studio (${serieExport.length} jours)`, false,
        blocCourbe("Vues par jour", serieExport.map((p) => ({ date: p.date, valeur: p.vues })), "valeur"),
        el("p", "discret", `${formaterNombre(exports.total_vues_jours)} vues sur la période.`),
      ));
    }
    plus.push(
      groupeDeLiens(
        "fp-acces",
        lien("TikTok Studio : analyses", "https://www.tiktok.com/tiktokstudio/analytics", "lien lien-principal"),
        lien("TikTok Studio : contenu", "https://www.tiktok.com/tiktokstudio/content"),
      ),
      el("p", "discret", "Les chiffres viennent des pages publiques TikTok (sans connexion) ; les analyses privées (audience, temps de visionnage) exigent un export CSV de TikTok Studio. Pour suivre une nouvelle vidéo, ajoute son adresse dans videos.txt."),
    );
  }
  carte.append(sectionFp("Voir plus", false, ...plus));
  return carte;
}

// Les boutons « 📹 groupe Telegram » d'un onglet : chaque groupe est dans l'onglet de son projet (voir groupesTelegramDe).
function liensDesGroupes(groupes) {
  return groupes.map((g) => lien(`📹 ${titreSur(g.nom)}`, lienPlateforme(g.lien), "lien lien-principal")).filter(Boolean);
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
  entete.append(el("h3", "", "Revenus"), el("span", "badge-attention", "Saisie à la main"), bouton("Actualiser", "bouton-secondaire", () => charger(true)));
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
    await charger(true);
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
        await charger(true);
      });
    });
    carte.append(supprimer);
  }
  return carte;
}

// ---------- Boutique : produits, ventes et revenus au même endroit ----------

// Le revenu par période, sa courbe sur 30 jours et les dernières ventes (Gumroad).
function blocVentes(ventes, maintenant) {
  const bloc = el("div", "bloc-ventes");
  if (!Array.isArray(ventes)) {
    bloc.append(el("p", "alerte alerte-info", "Le détail des ventes est indisponible pour le moment."));
    return bloc;
  }
  const revenu = revenuParPeriode(ventes, maintenant);
  const symbole = symboleDevise(revenu.devise);
  const chiffres = el("div", "fp-chiffres");
  const periode = (nom, p) => tuileTexte(nom, formaterMontant(p.cents, symbole), `${p.nb} vente${p.nb > 1 ? "s" : ""}`);
  chiffres.append(periode("Aujourd'hui", revenu.aujourdhui), periode("7 jours", revenu.sept), periode("30 jours", revenu.trente));
  bloc.append(el("p", "cmd-titre", "Revenu"), chiffres);
  if (revenu.autresDevises) bloc.append(el("p", "discret", "Les ventes faites dans une autre monnaie ne sont pas comptées ici."));
  if (revenu.trente.nb > 0) {
    bloc.append(blocCourbe(`Revenu des 30 derniers jours (en ${symbole})`, courbeRevenu(ventes, maintenant, 30).map((p) => ({ date: p.date, valeur: p.valeur / 100 })), "valeur"));
  }
  const recentes = ventesRecentes(ventes, 5);
  bloc.append(sectionFp(`Dernières ventes (${recentes.length})`, recentes.length > 0, listeFp(
    recentes.map((v) => ligneFp(`${formaterMontant(v.montant_cents, symboleDevise(v.devise))} · ${abreger(v.produit, 70)}`, `${ageLisible(v.quand, maintenant)}${v.rembourse ? " · remboursée" : ""}`)),
    "Aucune vente sur les 35 derniers jours.",
  )));
  return bloc;
}

function carteBoutique(produits, gumroad, etat, carteDesRevenus, maintenant, groupesTelegram = []) {
  const carte = el("article", "carte carte-large");
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", "Boutique"), bouton("Actualiser", "bouton-secondaire", () => charger(true)));
  carte.append(entete);
  const liensGroupes = liensDesGroupes(groupesTelegram);
  if (liensGroupes.length > 0) carte.append(groupeDeLiens("fp-acces", ...liensGroupes));

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
    tuiles.append(
      grosseTuile({ ton: "accent", valeur: formaterNombre(calendrier.aujourdhui.length), libelle: "vidéos à poster aujourd'hui", detail: prochaine && prochaine.quand ? `prochaine ${delaiAvant(prochaine.quand, maintenant)}` : "" }, "🎬"),
      grosseTuile({ ton: "success", valeur: `${formaterNombre(compteurs.videos_faites)} / ${formaterNombre(compteurs.videos_prevues)}`, libelle: "vidéos publiées" }, "✅"),
    );
  }
  if (tuiles.childElementCount > 0) carte.append(tuiles);

  const aVerifier = groupesDeTaches([produits, gumroad].filter(Boolean))[0];
  if (aVerifier) {
    carte.append(el("p", `alerte alerte-${aVerifier.niveau === "erreur" ? "erreur" : "avertissement"}`,
      `${aVerifier.nb > 1 ? `${aVerifier.nb} points à vérifier, dont : ` : ""}${aVerifier.texte}`));
  }

  if (gumroad && g.etat === "ok") carte.append(blocVentes(g.ventes, maintenant));

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

// ---------- Prospection : envoyer les e-mails et suivre les messages privés depuis le tableau (page en ligne) ----------
// La liste vient du dépôt livraisons-videos (branche prospection), écrite par la routine. Un bouton ouvre un ticket
// « mail_<id> » (le brouillon Gmail de la ligne part tel quel) ou « fait_<id> » (message privé envoyé à la main) ;
// le workflow « Envoi des messages de prospection » l'applique dans la minute, répond dans le ticket et le ferme.

let listeProspection = null; // { maj, actions } ; null tant qu'elle n'est pas lue (ou sans clé GitHub)
let erreurProspection = null; // pourquoi la liste n'a pas pu être lue, en une phrase
let prospectionEnAttente = new Set(); // identifiants des lignes dont l'ordre est parti (ticket encore ouvert)
const reponsesProspection = new Map(); // identifiant -> dernière réponse du workflow, montrée sous la ligne
const messagesProspection = new Map(); // identifiant -> { texte, type } : dernier message local (copié, erreur…)

async function lireProspection() {
  listeProspection = null;
  erreurProspection = null;
  const jeton = lireJetonGithub();
  const depot = depotProspection(depotConcours);
  if (!EN_LIGNE || !jeton || !depot) return;
  try {
    const reponse = await fetch(`https://api.github.com/repos/${depot}/contents/prospection.json?ref=prospection`, {
      headers: { ...enTetesGithub(jeton), Accept: "application/vnd.github.raw+json" }, cache: "no-store",
    });
    if (!reponse.ok) {
      erreurProspection = messageListeProspection(reponse.status);
      return;
    }
    listeProspection = lireListeProspection(await reponse.json());
    const tickets = await fetch(`https://api.github.com/repos/${depot}/issues?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (tickets.ok) prospectionEnAttente = ordresProspectionEnAttente(await tickets.json());
  } catch {
    erreurProspection = messageListeProspection(0);
  }
}

async function creerTicketProspection(titre) {
  const jeton = lireJetonGithub();
  const depot = depotProspection(depotConcours);
  if (!jeton || !depot || !titre) return { ok: false, erreur: "Clé GitHub absente : actualise la page." };
  const base = `https://api.github.com/repos/${depot}/issues`;
  try {
    const ouverts = await fetch(`${base}?state=open&per_page=100`, { headers: enTetesGithub(jeton), cache: "no-store" });
    if (ouverts.ok) {
      const tickets = await ouverts.json();
      if (Array.isArray(tickets) && tickets.some((t) => t && t.title === titre)) return { ok: false, erreur: "C'est déjà demandé : la réponse arrive dans la minute." };
    }
    const reponse = await fetch(base, {
      method: "POST", headers: { ...enTetesGithub(jeton), "Content-Type": "application/json" },
      body: JSON.stringify({ title: titre, body: "Ordre donné depuis le tableau de bord (carte Prospection)." }),
    });
    if (reponse.status !== 201) return { ok: false, erreur: reponse.status === 404 || reponse.status === 403 ? messageListeProspection(404) : messageErreurGithub(reponse.status) };
    let numero = null;
    try {
      numero = (await reponse.json()).number;
    } catch {
      // le numéro sert seulement à suivre la réponse
    }
    return { ok: true, numero };
  } catch {
    return { ok: false, erreur: "GitHub est injoignable : réessaie dans un moment." };
  }
}

// Attend que le workflow ferme le ticket (2 min 30 au plus) ; rend sa réponse, ou null.
async function attendreReponseWorkflow(numero) {
  const jeton = lireJetonGithub();
  const depot = depotProspection(depotConcours);
  if (!jeton || !depot || !Number.isInteger(numero)) return null;
  const base = `https://api.github.com/repos/${depot}/issues/${numero}`;
  const debut = Date.now();
  while (Date.now() - debut < DUREE_SUIVI_ORDRE_MS) {
    await pause(DELAI_SUIVI_ORDRE_MS);
    try {
      const ticket = await fetch(base, { headers: enTetesGithub(jeton), cache: "no-store" });
      if (!ticket.ok) return null;
      if ((await ticket.json()).state !== "closed") continue;
      const commentaires = await fetch(`${base}/comments?per_page=10`, { headers: enTetesGithub(jeton), cache: "no-store" });
      return commentaires.ok ? reponseDuWorkflow(await commentaires.json()) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function copierTexte(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // vieux navigateur ou permission refusée : on passe par une zone de texte cachée
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.append(zone);
    zone.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    zone.remove();
    return ok;
  }
}

const jourCourt = (iso) => (typeof iso === "string" && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "?");
const ICONES_PROSPECTION = { email: "📧", dm: "💬", verifier: "🔍" };

// Une ligne de la liste, avec ses boutons. `rafraichir` redessine la carte entière.
function ligneProspection(a, maintenant, rafraichir) {
  const ligne = el("div", "pr-ligne");
  const titre = el("p", "pr-titre");
  titre.append(el("span", "pr-icone", ICONES_PROSPECTION[a.type] ?? "•"), el("strong", "", a.pseudo));
  if (a.plateforme) titre.append(el("span", "discret", ` · ${a.plateforme}`));
  if (a.enRetard) titre.append(el("span", "badge-attention pr-badge", `prévu le ${jourCourt(a.jour)}`));
  else if (a.jour > jourParis(maintenant) && a.statut === "à envoyer") titre.append(el("span", "discret pr-badge", `le ${jourCourt(a.jour)}`));
  ligne.append(titre);
  if (a.type === "email" && a.objet) ligne.append(el("p", "discret pr-meta", `Objet : ${abreger(a.objet, 110)}`));
  if (a.statut === "à envoyer") {
    // Un profil à vérifier : les notes disent quoi vérifier, on les montre. Sinon elles restent repliées avec le message.
    if (a.type === "verifier" && a.notes) ligne.append(el("p", "discret pr-meta", abreger(a.notes, 300)));
    const replies = [];
    if (a.type === "dm" && a.message) replies.push(el("p", "pr-message", a.message));
    if (a.type !== "verifier" && a.notes) replies.push(el("p", "discret pr-meta", a.notes));
    if (replies.length > 0) ligne.append(sectionFp(a.type === "dm" ? "Voir le message et les notes" : "Notes", false, ...replies));
  }

  const message = el("p", "cmd-message");
  message.setAttribute("role", "status");
  const local = messagesProspection.get(a.id);
  const retour = reponsesProspection.get(a.id) ?? (a.statut === "à envoyer" ? a.retour : "");
  if (local) ecrireMessage(message, local.texte, local.type);
  else if (retour) ecrireMessage(message, retour, /^✅|^Noté|^🧪/.test(retour) ? "ok" : "erreur");
  const boutons = el("div", "cc-boutons pr-boutons");
  ligne.append(boutons, message);

  const faitIci = /^(✅|Noté)/.test(reponsesProspection.get(a.id) ?? ""); // fait depuis cette page : la liste se met à jour juste après
  if (a.statut === "envoyé" || a.statut === "vérifié" || faitIci) {
    boutons.append(el("span", "badge-ok", `${a.statut === "vérifié" ? "Vérifié" : "Envoyé"}${a.envoye_le ? ` le ${jourCourt(a.envoye_le)}` : ""}`));
    return ligne;
  }
  if (prospectionEnAttente.has(a.id)) {
    boutons.append(el("span", "badge-attention", "En cours : réponse dans la minute"));
    return ligne;
  }

  const donnerOrdre = async (texteAttente) => {
    boutons.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    const reponse = await creerTicketProspection(titreOrdreProspection(a));
    if (!reponse.ok) {
      messagesProspection.set(a.id, { texte: reponse.erreur, type: "erreur" });
      rafraichir();
      return;
    }
    messagesProspection.set(a.id, { texte: texteAttente, type: "info" });
    prospectionEnAttente.add(a.id);
    rafraichir();
    const texte = await attendreReponseWorkflow(reponse.numero);
    messagesProspection.delete(a.id);
    reponsesProspection.set(a.id, texte ?? "Pas encore de réponse de GitHub : regarde de nouveau dans quelques minutes.");
    await charger(true);
  };

  const profil = lien("Ouvrir le profil", a.lien, "bouton bouton-secondaire");
  if (a.type === "email") {
    const envoyer = bouton("📧 Envoyer", "bouton-principal", () => confirmerEnvoi());
    boutons.append(...[envoyer, profil].filter(Boolean));
    const confirmerEnvoi = () => {
      envoyer.disabled = true;
      let restant = 30;
      const compte = el("p", "discret cmd-compte", `Expire dans ${restant} s`);
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
          envoyer.disabled = false;
          ecrireMessage(message, "Confirmation expirée : recommence.", "erreur");
        } else {
          compte.textContent = `Expire dans ${restant} s`;
        }
      }, 1000);
      const confirmer = bouton("Oui, envoyer", "bouton-principal", async () => {
        confirmer.disabled = true;
        fermer();
        await donnerOrdre("Envoi demandé : GitHub l'envoie dans la minute…");
      });
      const annuler = bouton("Annuler", "bouton-secondaire", () => {
        fermer();
        envoyer.disabled = false;
        ecrireMessage(message, "Annulé : rien n'est parti.", "info");
      });
      panneau.setAttribute("role", "group");
      panneau.setAttribute("aria-label", "Confirmation");
      panneau.append(
        el("p", "cmd-titre", `Envoyer l'e-mail à ${a.pseudo} ?`),
        el("p", "cmd-avertissement", `Le brouillon Gmail part tel quel${a.a ? ` à ${a.a}` : ""}. Il ne peut pas être rattrapé une fois parti.`),
        compte,
        groupeDeLiens("cmd-actions", confirmer, annuler),
      );
      ligne.append(panneau);
    };
  } else {
    const copier = a.type === "dm" && a.message
      ? bouton("📋 Copier le message", "bouton-secondaire", async () => {
        const ok = await copierTexte(a.message);
        ecrireMessage(message, ok ? "Message copié : ouvre le profil et colle-le dans la conversation." : "Copie impossible : ouvre « Voir le message » et sélectionne le texte.", ok ? "ok" : "erreur");
      })
      : null;
    const fait = bouton(a.type === "dm" ? "✅ C'est envoyé" : "✅ Vérifié", "bouton-principal", () => donnerOrdre("C'est noté : GitHub met la liste à jour dans la minute…"));
    boutons.append(...[copier, profil, fait].filter(Boolean));
  }
  return ligne;
}

function carteProspection(maintenant) {
  const carte = el("article", "carte carte-large");
  const entete = el("div", "fp-entete");
  entete.append(el("h3", "", "Prospection"));
  carte.append(entete);
  if (erreurProspection) {
    carte.append(el("p", "alerte alerte-avertissement", erreurProspection));
    return carte;
  }
  if (!listeProspection) return null;
  const classement = classerProspection(listeProspection.actions, maintenant);
  const resume = resumeProspection(classement.compte);
  entete.append(el("span", classement.aFaire.length > 0 ? "badge-attention" : "badge-ok", classement.aFaire.length > 0 ? `${classement.aFaire.length} à faire` : "À jour"));
  carte.append(el("p", "discret", resume
    ? `Aujourd'hui : ${resume}. Les e-mails partent d'un bouton ; les messages privés se copient, puis « C'est envoyé ».`
    : "Rien à envoyer aujourd'hui."));

  const zone = el("div", "pr-zone");
  carte.append(zone);
  const dessiner = () => {
    const c = classerProspection(listeProspection.actions, new Date());
    zone.replaceChildren();
    for (const a of c.aFaire) zone.append(ligneProspection(a, new Date(), dessiner));
    if (c.aVenir.length > 0) zone.append(sectionFp(`À venir (${c.aVenir.length})`, false, ...c.aVenir.map((a) => ligneProspection(a, new Date(), dessiner))));
    if (c.faits.length > 0) zone.append(sectionFp(`Déjà fait (${c.faits.length})`, false, ...c.faits.map((a) => ligneProspection(a, new Date(), dessiner))));
  };
  dessiner();
  if (listeProspection.maj) carte.append(el("p", "discret", `Liste préparée par la routine ${ageLisible(listeProspection.maj, maintenant)}.`));
  return carte;
}

// ---------- Accueil : l'essentiel d'un coup d'œil ----------

const ICONES_TUILES = { concours: "🎁", abonnes: "👥", revenu: "💰", live: "🔴" };
const MAX_A_FAIRE = 3;

// Quatre gros chiffres, ce qu'il faut faire en premier (trois lignes au plus, une par thème), le prochain rendez-vous.
function blocAccueil(projets, etat, maintenant) {
  const tuiles = tuilesAccueil(projets, etat);
  const groupes = groupesDeTaches(projets);
  const prospection = listeProspection ? tacheProspection(classerProspection(listeProspection.actions, maintenant)) : null;
  if (prospection) groupes.unshift(prospection);
  const agenda = construireAgenda(projets, maintenant);
  if (tuiles.length === 0 && groupes.length === 0 && agenda.length === 0) return null;
  const section = el("section", "accueil");
  const phrase = phraseAccueil(groupes, bilanSemaine(projets, maintenant));
  const hero = el("div", "hero");
  hero.dataset.etat = phrase.etat; // vert / orange / rouge selon ce qu'il y a à faire
  hero.append(el("p", "hero-salut", salutation(heureDeParis(maintenant))), el("p", "hero-phrase", phrase.texte));
  section.append(hero);
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
  carte.append(el("p", "cmd-titre", groupes.length > 0 ? "À faire" : "Rien à faire ✓"));
  for (const groupe of groupes.slice(0, MAX_A_FAIRE)) carte.append(ligneDe(groupe));
  if (groupes.length > MAX_A_FAIRE) carte.append(sectionFp(`+${groupes.length - MAX_A_FAIRE}`, false, ...groupes.slice(MAX_A_FAIRE).map(ligneDe)));
  if (agenda.length > 0) {
    carte.append(el("p", "accueil-rdv", `Prochain : ${agenda[0].texte} · ${delaiAvant(agenda[0].quand, maintenant)}`));
    if (agenda.length > 1) {
      carte.append(sectionFp(`+${agenda.length - 1}`, false, listeFp(
        agenda.slice(1).map((e) => ligneFp(e.texte, `${delaiAvant(e.quand, maintenant)} · ${rendezVous({ quand: e.quand })} · ${e.source}`)),
        "",
      )));
    }
  }
  const objectif = progressionObjectifTelegram(projets);
  if (objectif) {
    const barre = document.createElement("progress");
    barre.max = 100;
    barre.value = objectif.pct;
    barre.setAttribute("aria-label", "Progression vers l'objectif d'abonnés Telegram");
    carte.append(
      el("p", "accueil-rdv", `Telegram : ${formaterNombre(objectif.abonnes)} / ${formaterNombre(objectif.objectif)}`),
      barre,
    );
  }
  const bilan = bilanSemaine(projets, maintenant);
  const signe = (n) => variation(n, 0).texte;
  const lignesBilan = [];
  if (bilan.telegram) {
    lignesBilan.push(ligneFp("Telegram", `${signe(bilan.telegram.gain)} abonnés depuis le ${bilan.telegram.depuis.slice(8, 10)}/${bilan.telegram.depuis.slice(5, 7)}`));
  }
  if (bilan.tiktokAbonnes !== null || bilan.tiktokVues !== null) {
    lignesBilan.push(ligneFp("TikTok", [bilan.tiktokAbonnes !== null ? `${signe(bilan.tiktokAbonnes)} abonnés` : null, bilan.tiktokVues !== null ? `${signe(bilan.tiktokVues)} vues` : null].filter(Boolean).join(" · ")));
  }
  if (bilan.publies7j !== null) lignesBilan.push(ligneFp("Concours", `${bilan.publies7j} publiés sur 7 jours`));
  if (bilan.ventes7j) {
    lignesBilan.push(ligneFp("Boutique", `${bilan.ventes7j.nb} vente${bilan.ventes7j.nb > 1 ? "s" : ""} · ${formaterMontant(bilan.ventes7j.cents, symboleDevise(bilan.ventes7j.devise))}`));
  }
  if (lignesBilan.length > 0) carte.append(sectionFp("Bilan de la semaine", false, listeFp(lignesBilan, "")));
  if (EN_LIGNE && historiqueOrdres.length > 0) {
    carte.append(sectionFp(`Derniers ordres (${historiqueOrdres.length})`, false, listeFp(
      historiqueOrdres.map((o) => ligneFp(`${o.icone} ${o.texte}`, ageLisible(o.quand, maintenant))),
      "",
    )));
  }
  section.append(carte);
  return section;
}

// ---------- Publier : l'agenda des vidéos TikTok, pour tout programmer d'avance ----------
// Une ligne par vidéo : l'heure, le compte, le titre, et des boutons pour copier la légende, les mots-dièses, le commentaire à épingler,
// et enregistrer la vidéo (tableau privé seulement : le fichier est sur le PC). « Fait » se coche sur cet appareil.

const CLE_FAITS_AGENDA = "tableau.agenda_faits";
const LIEN_TIKTOK_STUDIO = "https://www.tiktok.com/tiktokstudio/upload";
const NOMS_DES_PROJETS = { concours: "Concours", boutique: "Boutique" };
let agendaPresent = false; // rebranché à chaque affichage : les blocs TikTok proposent alors d'ouvrir l'agenda
let projetsAffiches = []; // rebranché à chaque affichage : les projets du relevé (l'agenda y trouve le groupe Telegram de chaque projet)

function lireFaits() {
  try {
    return idsFaitsValides(JSON.parse(lireStockage(CLE_FAITS_AGENDA) ?? "[]"));
  } catch {
    return [];
  }
}

function ecrireFaits(ids) {
  ecrireStockage(CLE_FAITS_AGENDA, JSON.stringify(idsFaitsValides(ids)));
}

// La pastille de l'onglet « Publier » suit les vidéos cochées, sans redessiner la page.
function majPastillePublier(videos) {
  const onglet = document.getElementById("onglet-publier");
  if (!onglet) return;
  onglet.querySelector(".pastille")?.remove();
  const pastille = pastillePublier(videos, jourParis(new Date()), lireFaits());
  if (pastille) onglet.append(el("span", `pastille pastille-${pastille.niveau}`, pastille.texte));
}

// Un bouton qui copie un texte et le dit (« ✓ Copié ») pendant un instant.
function boutonCopier(libelle, texte) {
  const b = bouton(libelle, "bouton-secondaire agenda-bouton", async () => {
    const ok = await copierTexte(texte);
    b.textContent = ok ? "✓ Copié" : "Copie impossible";
    setTimeout(() => { b.textContent = libelle; }, 1600);
  });
  return b;
}

// ---------- Le lecteur de vidéos (onglet Publier) ----------
// « ▶️ Vidéo » : la vidéo s'affiche dans l'appli (récupérée, et déchiffrée si elle vient de la copie chiffrée en ligne), avec
// « 📲 Enregistrer » pour la garder sur le téléphone ou l'envoyer à TikTok. Les dernières vidéos ouvertes restent en mémoire pendant la visite.

const VIDEOS_EN_MEMOIRE = 3;
const videosEnMemoire = new Map(); // id de la vidéo → File (la plus récente en dernier)
let fermerLecteurOuvert = null;

async function recupererVideo(adresse, options, nom) {
  const reponse = await fetch(adresse, options);
  if (!reponse.ok) throw new Error(String(reponse.status));
  const contenu = await reponse.blob();
  const nomFichier = nom ?? /filename="([^"]+)"/.exec(reponse.headers.get("Content-Disposition") ?? "")?.[1] ?? "video.mp4";
  return new File([contenu], nomFichier, { type: contenu.type || "video/mp4" });
}

// La copie chiffrée (branche « videos » du dépôt de la page) : une lecture simple, sans en-tête, puis déchiffrée avec la clé de la page.
async function recupererVideoChiffree(adresse, nom) {
  if (!cleDeLaPage) throw new Error("clé absente");
  const reponse = await fetch(adresse); // cache normal : un « introuvable » passager (juste après un envoi) n'est pas gardé longtemps
  if (!reponse.ok) throw new Error(String(reponse.status));
  const clair = await dechiffrerOctets(new Uint8Array(await reponse.arrayBuffer()), cleDeLaPage);
  return new File([clair], nom, { type: "video/mp4" });
}

async function videoEnMemoire(id, charger) {
  if (videosEnMemoire.has(id)) {
    const fichier = videosEnMemoire.get(id);
    videosEnMemoire.delete(id);
    videosEnMemoire.set(id, fichier);
    return fichier;
  }
  const fichier = await charger();
  videosEnMemoire.set(id, fichier);
  while (videosEnMemoire.size > VIDEOS_EN_MEMOIRE) videosEnMemoire.delete(videosEnMemoire.keys().next().value);
  return fichier;
}

// Sur téléphone : la feuille de partage (« Enregistrer la vidéo » ou TikTok directement). Ailleurs : un téléchargement.
function boutonEnregistrer(fichier) {
  const mode = modeEnregistrement({
    tactile: window.matchMedia("(pointer: coarse)").matches,
    partageFichiers: typeof navigator.canShare === "function" && typeof navigator.share === "function",
  });
  return bouton("📲 Enregistrer", "bouton-principal lecteur-enregistrer", async () => {
    if (mode === "telechargement" || !navigator.canShare({ files: [fichier] })) {
      telechargerFichier(fichier);
      return;
    }
    try {
      await navigator.share({ files: [fichier] });
    } catch {
      // partage annulé ou refusé : un nouvel appui suffit
    }
  });
}

// `secours` : { message, lien } — ce qui s'affiche si la vidéo ne vient pas (le lien du groupe Telegram en ligne).
function boutonLecteur(v, charger, secours) {
  return bouton("▶️ Vidéo", "bouton-secondaire agenda-bouton", () => ouvrirLecteur(v, charger, secours));
}

function ouvrirLecteur(v, charger, secours) {
  if (fermerLecteurOuvert) fermerLecteurOuvert();
  const precedent = document.activeElement;
  const titre = [v.heure, v.format].filter(Boolean).join(" · ") || "Vidéo";
  const fond = el("div", "lecteur");
  fond.setAttribute("role", "dialog");
  fond.setAttribute("aria-modal", "true");
  fond.setAttribute("aria-label", `Vidéo ${titre}`);
  const haut = el("div", "lecteur-haut");
  const fermer = bouton("✕", "bouton-secondaire lecteur-fermer", () => fermerLecteur());
  fermer.setAttribute("aria-label", "Fermer la vidéo");
  haut.append(el("span", "lecteur-titre", titre), fermer);
  const scene = el("div", "lecteur-scene");
  const attente = el("p", "lecteur-attente", "⏳ Chargement…");
  scene.append(attente);
  const bas = el("div", "lecteur-bas");
  fond.append(haut, scene, bas);
  document.body.append(fond);
  document.body.classList.add("lecteur-actif");
  let adresse = null;
  let ferme = false;

  function touche(e) {
    if (e.key === "Escape") fermerLecteur();
  }

  function fermerLecteur() {
    if (ferme) return;
    ferme = true;
    document.removeEventListener("keydown", touche);
    const video = scene.querySelector("video");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (adresse) URL.revokeObjectURL(adresse);
    fond.remove();
    document.body.classList.remove("lecteur-actif");
    fermerLecteurOuvert = null;
    if (precedent && typeof precedent.focus === "function") precedent.focus();
  }

  document.addEventListener("keydown", touche);
  fond.addEventListener("click", (e) => {
    if (e.target === fond || e.target === scene) fermerLecteur();
  });
  fermerLecteurOuvert = fermerLecteur;
  fermer.focus();

  videoEnMemoire(v.id, charger).then((fichier) => {
    if (ferme) return;
    adresse = URL.createObjectURL(fichier);
    const video = el("video", "lecteur-video");
    video.controls = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.src = adresse;
    attente.replaceWith(video);
    video.play().catch(() => {}); // certains téléphones attendent un appui sur ▶
    bas.append(boutonEnregistrer(fichier));
  }).catch(() => {
    if (ferme) return;
    attente.textContent = secours.message;
    if (secours.lien) bas.append(secours.lien);
  });
}

function telechargerFichier(fichier) {
  const adresse = URL.createObjectURL(fichier);
  const a = el("a");
  a.href = adresse;
  a.download = fichier.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 60_000);
}

function ligneAgenda(v, faits, videos) {
  const ligne = el("div", faits.includes(v.id) ? "agenda-video agenda-faite" : "agenda-video");
  const haut = el("div", "agenda-haut");
  haut.append(el("span", "agenda-heure", v.heure), el("span", `agenda-compte agenda-compte-${v.projet}`, NOMS_DES_PROJETS[v.projet]));
  if (v.divulgation === true) haut.append(el("span", "agenda-divulgation", "📢 Divulgation"));
  const fait = bouton(faits.includes(v.id) ? "✓ Fait" : "Fait", "bouton-secondaire agenda-fait", () => {
    const ids = basculerFait(lireFaits(), v.id);
    ecrireFaits(ids);
    const coche = ids.includes(v.id);
    ligne.classList.toggle("agenda-faite", coche);
    fait.textContent = coche ? "✓ Fait" : "Fait";
    fait.setAttribute("aria-pressed", String(coche));
    majPastillePublier(videos);
    const jour = ligne.closest("details.fp-section");
    if (jour) majTitreDuJour(jour);
  });
  fait.setAttribute("aria-pressed", String(faits.includes(v.id)));
  haut.append(fait);
  ligne.append(haut);
  const titre = [v.format, v.titre].filter(Boolean).join(" · ");
  if (titre) ligne.append(el("p", "agenda-titre", abreger(titre, 90)));

  const boutons = el("div", "agenda-boutons");
  if (v.legende) boutons.append(boutonCopier("📋 Légende", v.legende));
  if (v.hashtags.length > 0) boutons.append(boutonCopier("# Hashtags", texteHashtags(v)));
  if (v.commentaire) boutons.append(boutonCopier("💬 Commentaire", v.commentaire));
  const jeton = EN_LIGNE ? lireJetonGithub() : null;
  const adresseChiffree = EN_LIGNE ? adresseVideoChiffree(v, videosChiffrees(chargeEnLigne)) : null;
  const source = sourceVideo(v, { enLigne: EN_LIGNE, cle: Boolean(jeton), chiffree: Boolean(adresseChiffree) });
  const adresseGithub = source === "github" ? adresseVideoGithub(v, depotConcours) : null;
  const groupe = EN_LIGNE ? groupesTelegramDe(projetsAffiches, v.projet)[0] : null;
  const lienTelegram = () => (groupe ? lien("📹 Telegram", lienPlateforme(groupe.lien), "bouton bouton-secondaire agenda-bouton") : null);
  if (source === "pc") {
    boutons.append(boutonLecteur(v, () => recupererVideo(`api/agenda/video/${v.id}`, { cache: "no-store" }, null),
      { message: "Vidéo introuvable : actualise la page.", lien: null }));
  } else if (source === "chiffree") { // la copie chiffrée envoyée par le PC (les 7 prochains jours)
    boutons.append(boutonLecteur(v, () => recupererVideoChiffree(adresseChiffree, nomDeVideo(v)),
      { message: "Vidéo pas lisible pour l'instant : elle est dans le groupe Telegram.", lien: lienTelegram() }));
  } else if (adresseGithub) {
    const options = { cache: "no-store", headers: { ...enTetesGithub(jeton), Accept: "application/vnd.github.raw" } };
    boutons.append(boutonLecteur(v, () => recupererVideo(adresseGithub, options, v.github.chemin.split("/").pop()),
      { message: "Vidéo plus sur GitHub : elle est dans le groupe Telegram.", lien: lienTelegram() }));
  } else if (source) { // pas de copie en ligne : la vidéo est dans le groupe Telegram du projet
    const lienGroupe = lienTelegram();
    if (lienGroupe) boutons.append(lienGroupe);
  }
  if (boutons.childElementCount > 0) ligne.append(boutons);
  if (!v.fichier) ligne.append(el("p", "discret agenda-note", "Vidéo pas encore prête."));
  return ligne;
}

// « Aujourd'hui · samedi 21/11 · 3 à faire » : recompté à chaque coche, sans redessiner la page.
function majTitreDuJour(section) {
  const resume = section.querySelector(":scope > summary");
  if (!resume || !section.dataset.jour) return;
  const restantes = section.querySelectorAll(".agenda-video:not(.agenda-faite)").length;
  resume.textContent = `${section.dataset.jour} · ${restantes > 0 ? `${restantes} à faire` : "tout est fait ✓"}`;
}

function carteAgenda(projet, maintenant) {
  const d = objet(projet.details);
  const videos = videosDeLAgenda([projet]);
  const faits = lireFaits();
  const carte = el("article", "carte carte-large carte-agenda");
  const entete = el("div", "fp-entete");
  const icone = el("span", "titre-icone");
  icone.append(iconeSvg("publier"));
  entete.append(icone, el("h3", "", "Vidéos à publier"), bouton("Actualiser", "bouton-secondaire", () => charger(true)));
  carte.append(entete);
  carte.append(groupeDeLiens("fp-acces", lien("⬆️ Programmer dans TikTok Studio", LIEN_TIKTOK_STUDIO, "lien lien-principal")));

  const groupes = groupesAgenda(videos, jourParis(maintenant));
  if (groupes.length === 0) {
    carte.append(el("p", "discret agenda-vide", messageAgendaVide(d)));
    return carte;
  }
  for (const g of groupes) {
    const section = sectionFp(g.titre, g.relatif !== "plus-tard", ...g.videos.map((v) => ligneAgenda(v, faits, videos)));
    section.dataset.jour = g.titre;
    majTitreDuJour(section);
    carte.append(section);
  }
  return carte;
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
  if (projet.adaptateur === "agenda-videos" && projet.statut === "ok") return carteSure(projet, maintenant, carteAgenda);
  if (projet.adaptateur === "produits-numeriques" && projet.statut === "ok") return carteSure(projet, maintenant, carteProduits);
  if (projet.adaptateur === "gumroad" && projet.statut === "ok") return carteSure(projet, maintenant, carteGumroad);
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
  // `anime` : le panneau glisse en douceur quand c'est l'utilisateur qui change de rubrique (pas au simple redessin de la page).
  const choisir = (id, focus = false, anime = false) => {
    ongletActif = id;
    memoriserOnglet(id);
    for (const b of boutons) {
      const actif = b.dataset.onglet === id;
      b.setAttribute("aria-selected", String(actif));
      b.tabIndex = actif ? 0 : -1;
      if (actif && focus) b.focus();
    }
    for (const [cle, panneau] of panneaux) panneau.hidden = cle !== id;
    const arrivant = panneaux.get(id);
    if (anime && arrivant && !sansMouvement()) {
      arrivant.classList.remove("entrant");
      void arrivant.offsetWidth; // relance l'animation même si l'on rechoisit la même rubrique
      arrivant.classList.add("entrant");
      arrivant.addEventListener("animationend", () => arrivant.classList.remove("entrant"), { once: true });
    }
  };
  onglets.forEach((o, i) => {
    const bouton = el("button", "onglet");
    bouton.type = "button";
    bouton.setAttribute("role", "tab");
    bouton.dataset.onglet = o.id;
    bouton.id = `onglet-${o.id}`;
    bouton.setAttribute("aria-controls", `panneau-${o.id}`);
    const icone = el("span", "onglet-icone");
    icone.append(iconeSvg(o.id));
    bouton.append(icone, el("span", "onglet-titre", o.titre));
    const pastille = o.id === "publier" ? pastillePublier(videosDeLAgenda(projets), jourParis(new Date()), lireFaits()) : pastilleOnglet(o.id, projets);
    if (pastille) bouton.append(el("span", `pastille pastille-${pastille.niveau}`, pastille.texte));
    bouton.addEventListener("click", () => {
      choisir(o.id, false, true);
      window.scrollTo(0, 0);
    });
    bouton.addEventListener("keydown", (e) => {
      const decalage = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (decalage === 0) return;
      e.preventDefault();
      choisir(onglets[(i + decalage + onglets.length) % onglets.length].id, true, true);
    });
    boutons.push(bouton);
    barre.append(bouton);
  });
  allerVersOnglet = (id) => {
    if (!onglets.some((o) => o.id === id)) return;
    choisir(id, false, true);
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
  agendaPresent = projets.some((p) => p && p.adaptateur === "agenda-videos" && p.statut === "ok");
  projetsAffiches = projets;
  try {
    const gumroad = projets.find((p) => p && p.adaptateur === "gumroad");
    const locaux = projets.filter((p) => p && p.adaptateur === "produits-numeriques").flatMap((p) => liste(objet(p.details).produits));
    const boutique = gumroad ? objet(gumroad.details).boutique : null;
    rapprochement = { ...rapprocherProduits(locaux, boutique), disponible: liste(objet(boutique).produits).length > 0 };
  } catch {
    rapprochement = { parLocal: {}, sansDossier: [], disponible: false };
  }
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
  const extras = revenus || comptesTiktokDeLOnglet(projets, "boutique").length > 0 ? ["boutique"] : []; // la boutique existe aussi pour son compte TikTok
  const onglets = rangerEnOnglets(projets, extras).filter((o) => o.id !== "resume" || vue);
  const panneaux = new Map();
  let generalPorte = false; // le premier bloc TikTok de la page porte aussi ce qui ne parle d'aucun compte
  const blocsTiktok = (onglet) => {
    const noeuds = [];
    for (const projet of projets.filter((p) => p && p.adaptateur === "tiktok" && p.statut === "ok")) {
      for (const compte of comptesTiktokDeLOnglet([projet], onglet)) {
        const general = !generalPorte;
        generalPorte = true;
        try {
          noeuds.push(blocTiktok(projet, compte, general, maintenant));
        } catch {
          const erreur = el("article", "carte carte-large");
          erreur.append(el("h3", "", `TikTok @${String(compte.compte)}`), el("p", "alerte alerte-erreur", "Données illisibles pour ce compte."));
          noeuds.push(erreur);
        }
      }
    }
    return noeuds;
  };
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
          cartes.append(carteBoutique(produits, gumroad, etatRevenus, revenus, maintenant, groupesTelegramDe(projets, "boutique")));
        } catch {
          const erreur = el("article", "carte carte-large");
          erreur.append(el("h3", "", "Boutique"), el("p", "alerte alerte-erreur", "Données illisibles pour la boutique."));
          cartes.append(erreur);
        }
      }
      cartes.append(...blocsTiktok("boutique"));
      let prospection = null;
      try {
        prospection = carteProspection(maintenant);
      } catch {
        prospection = null; // la liste est un plus : une donnée inattendue ne doit pas cacher la boutique
      }
      if (prospection) {
        const urgent = listeProspection && classerProspection(listeProspection.actions, maintenant).aFaire.length > 0;
        if (urgent) cartes.prepend(prospection);
        else cartes.append(prospection);
      }
      for (const projet of o.projets) if (projet !== produits && projet !== gumroad) cartes.append(carteDuProjet(projet, maintenant));
    } else {
      for (const projet of o.projets) {
        if (projet.adaptateur === "tiktok" && projet.statut === "ok") continue; // ses comptes ont chacun leur bloc, dans l'onglet de leur projet
        cartes.append(carteDuProjet(projet, maintenant));
      }
      if (o.id === "concours") cartes.append(...blocsTiktok("concours"));
    }
    if (cartes.childElementCount > 0) panneau.append(cartes);
    panneaux.set(o.id, panneau);
  }
  const noeuds = [];
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
  ecrireSousTitre(paquet, maintenant);
  animerChiffres(contenu);
}

// Sous le titre : depuis quand les données datent, ou « PC éteint » (dit ici, sans bandeau).
function ecrireSousTitre(paquet, maintenant) {
  const pcEteint = EN_LIGNE && chargeEnLigne ? messagePcEteint(chargeEnLigne.publie_a, maintenant, chargeEnLigne.cloud_a) : null;
  generation.textContent = EN_LIGNE && chargeEnLigne
    ? (pcEteint ?? `Mis à jour ${ageLisible(chargeEnLigne.publie_a, maintenant)}`)
    : `Mis à jour ${ageLisible(paquet.genere_a, maintenant)}`;
}

// ---------- Mode en ligne : page publique, données chiffrées, boutons ✅ / ❌ par la boîte aux ordres de GitHub ----------

const CLE_MOT_DE_PASSE = "tableau.mot_de_passe";
const CLE_JETON_GITHUB = "tableau.jeton_github";
let motDePasse = null; // gardé en mémoire tant que la page est ouverte
let chargementEnCours = false;
let chargeEnLigne = null; // { paquet, revenus, publie_a } : le contenu du fichier chiffré une fois ouvert
let cleDeLaPage = null; // la clé tirée du mot de passe : elle déchiffre aussi les vidéos mises en ligne par le PC

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
      const cle = await deriverCle(motDePasse, enveloppe);
      const charge = await dechiffrer(enveloppe, cle);
      cleDeLaPage = cle; // la même clé ouvre les vidéos chiffrées
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

// Le relevé du robot GitHub (abonnés Telegram relevés PC éteint), déchiffré avec le même mot de passe ; null s'il n'existe pas ou n'est pas lisible.
async function lireReleveCloud() {
  try {
    const reponse = await fetch("data.cloud.enc.json", { cache: "no-store" });
    if (!reponse.ok) return null;
    const enveloppe = await reponse.json();
    return await dechiffrer(enveloppe, await deriverCle(motDePasse, enveloppe));
  } catch {
    return null;
  }
}

let derniereEmpreinte = null; // ce qui a servi au dernier dessin de la page : s'il n'a pas changé, on ne redessine pas
let dernierRenduMs = null;
let entreeTerminee = false;

async function chargerUneFois(force = false) {
  let paquet;
  try {
    if (EN_LIGNE) {
      chargeEnLigne = await lireChargeEnLigne();
      const maintenantCharge = new Date();
      if (messagePcEteint(chargeEnLigne.publie_a, maintenantCharge) !== null) { // PC éteint : on ne cherche le relevé du robot que dans ce cas
        chargeEnLigne = fusionnerReleveCloud(chargeEnLigne, await lireReleveCloud(), maintenantCharge);
      }
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
  if (EN_LIGNE && decisionsDisponibles) await Promise.all([lireOrdresEnAttenteGithub(), lireProspection()]);
  etatRevenus = EN_LIGNE ? ((chargeEnLigne && chargeEnLigne.revenus) || null) : await lireEtatRevenus();
  planifierEnvoi(); // reprend les décisions gardées dans le téléphone (page fermée avant la fin de l'envoi)
  // Rafraîchissement automatique : si rien n'a changé, la page reste exactement comme elle est (pas de clignotement, on garde sa place).
  const empreinte = empreinteDuRendu([
    paquet, etatRevenus, decisionsDisponibles, listeProspection, historiqueOrdres, dernierResultat, [...ordresEnvoyes], [...numerosOrdres],
  ]);
  if (!doitRedessiner(derniereEmpreinte, empreinte, dernierRenduMs, Date.now(), force)) {
    ecrireSousTitre(paquet, new Date());
    return;
  }
  const ouvertes = Array.from(document.querySelectorAll("details.fp-section")).map((d) => d.open);
  const haut = window.scrollY;
  try {
    afficher(paquet);
  } catch {
    afficherMessage("Données illisibles : le fichier est abîmé ou d'une version inconnue.", "erreur");
    return;
  }
  derniereEmpreinte = empreinte;
  dernierRenduMs = Date.now();
  // La page se redessine : on garde les sections que l'utilisateur avait ouvertes ou fermées (même structure seulement) et sa place.
  const sections = Array.from(document.querySelectorAll("details.fp-section"));
  if (sections.length === ouvertes.length) sections.forEach((d, i) => { d.open = ouvertes[i]; });
  if (haut > 0) window.scrollTo(0, haut);
  if (!entreeTerminee) {
    entreeTerminee = true;
    setTimeout(() => document.body.classList.remove("entree"), 1500); // les apparitions du début sont finies : plus rien ne rejoue
  }
}

// Une seule lecture à la fois : le rafraîchissement automatique ne doit pas empiler des formulaires de mot de passe.
// `force` : demandé à la main (bouton, tirer vers le bas, après une action) -> la page est toujours redessinée.
async function charger(force = false) {
  if (chargementEnCours) return;
  chargementEnCours = true;
  try {
    await chargerUneFois(force);
  } finally {
    chargementEnCours = false;
  }
}

// Tirer la page vers le bas, tout en haut, l'actualise (comme dans une appli).
function installerTirerPourActualiser() {
  const bandeau = el("div", "tirer");
  bandeau.setAttribute("aria-hidden", "true");
  document.body.append(bandeau);
  let depart = null;
  let distance = 0;
  const reinitialiser = () => {
    depart = null;
    distance = 0;
    bandeau.dataset.etat = "";
  };
  document.addEventListener("touchstart", (e) => {
    depart = e.touches.length === 1 ? e.touches[0].clientY : null;
    distance = 0;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (depart === null || e.touches.length !== 1) return;
    distance = distanceTiree(depart, e.touches[0].clientY, window.scrollY);
    bandeau.dataset.etat = distance === 0 ? "" : doitActualiser(distance) ? "relacher" : "tirer";
    bandeau.textContent = doitActualiser(distance) ? "Relâchez pour actualiser" : distance > 0 ? "Tirez pour actualiser" : "";
  }, { passive: true });
  document.addEventListener("touchend", () => {
    const actualiser = doitActualiser(distance);
    reinitialiser();
    if (actualiser) charger(true);
  }, { passive: true });
  document.addEventListener("touchcancel", reinitialiser, { passive: true });
}

installerTirerPourActualiser();
charger();
// Rafraîchissement automatique, sauf pendant une confirmation ou quand l'onglet est caché.
setInterval(() => {
  if (confirmationsOuvertes === 0 && !document.hidden) charger();
}, DELAI_RAFRAICHISSEMENT_MS);
