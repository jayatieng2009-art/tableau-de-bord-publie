// Fonctions pures du tableau de bord : âge des données, libellés.
// Utilisable dans le navigateur et dans Node (tests/lib.test.mjs).

const SECONDE = 1000;
const MINUTE = 60 * SECONDE;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

// Durée écoulée depuis `iso`, en millisecondes ; null si la date est illisible.
function ecoule(iso, maintenant) {
  if (typeof iso !== "string") return null; // un nombre ou un objet n'est pas une date (Date.parse(12) donnerait 2001)
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : maintenant.getTime() - t;
}

export function ageLisible(iso, maintenant) {
  const ms = ecoule(iso, maintenant);
  if (ms === null) return "date inconnue";
  if (ms < MINUTE) return "à l'instant"; // inclut les dates futures (horloge du PC en avance)
  if (ms < HEURE) return `il y a ${Math.floor(ms / MINUTE)} min`;
  if (ms < JOUR) return `il y a ${Math.floor(ms / HEURE)} h`;
  return `il y a ${Math.floor(ms / JOUR)} j`;
}

export function estPerime(iso, maintenant, seuilHeures) {
  const ms = ecoule(iso, maintenant);
  if (ms === null) return true; // une date illisible ne prouve pas que la donnée est fraîche
  return ms > seuilHeures * HEURE;
}

const LIBELLES_STATUT = {
  ok: "Relevé réussi",
  introuvable: "Dossier introuvable",
  "pas-de-git": "Pas de dépôt git",
  "aucun-commit": "Aucun commit",
  erreur: "Erreur de relevé",
};

export function libelleStatut(statut) {
  return Object.hasOwn(LIBELLES_STATUT, statut) ? LIBELLES_STATUT[statut] : "Statut inconnu";
}

// ---------- Falling Pickaxe (étape B) ----------

const HEURES_STATISTIQUES_PERIMEES = 36;
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const ID_CHAINE = /^UC[A-Za-z0-9_-]{22}$/;
const HOTES_YOUTUBE = new Set(["youtube.com", "www.youtube.com", "studio.youtube.com", "youtu.be"]);
const RUBRIQUES_STUDIO = { content: "videos/upload", live: "livestreaming" };

const estNombre = (valeur) => typeof valeur === "number" && Number.isFinite(valeur);

// 33309 -> « 33 309 » ; décimal à une décimale ; « ? » si ce n'est pas un nombre exploitable.
export function formaterNombre(n) {
  if (!estNombre(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return "?";
  if (!Number.isInteger(n)) return n.toFixed(1).replace(".", ",");
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Écart entre deux nombres : « +1 », « −3 » (vrai signe moins), « 0 » ou « ? ».
export function variation(actuel, precedent) {
  if (!estNombre(actuel) || !estNombre(precedent)) return { texte: "?", sens: "inconnu" };
  const ecart = actuel - precedent;
  if (ecart > 0) return { texte: `+${ecart}`, sens: "hausse" };
  if (ecart < 0) return { texte: `−${-ecart}`, sens: "baisse" };
  return { texte: "0", sens: "stable" };
}

export function pourcentageQuota(unites, limite) {
  if (!estNombre(unites) || !estNombre(limite) || limite <= 0 || unites < 0) return 0;
  return Math.min(100, Math.round((unites / limite) * 100));
}

const GRAVITE = { erreur: 0, avertissement: 1, info: 2 };

// Ce que l'utilisateur doit savoir d'un coup d'œil, du plus grave au moins grave. Ne plante jamais.
export function alertesFalling(details, maintenant) {
  const d = details && typeof details === "object" ? details : {};
  const alertes = [];

  if (d.live && typeof d.live === "object" && d.live.en_cours === false) {
    alertes.push({ niveau: "info", texte: "Le direct est arrêté." });
  }

  const quota = d.quota && typeof d.quota === "object" ? d.quota : {};
  if (estNombre(quota.unites) && estNombre(quota.limite)) {
    const pct = pourcentageQuota(quota.unites, quota.limite);
    if (pct >= 95) alertes.push({ niveau: "erreur", texte: `Quota YouTube presque épuisé : ${pct} % utilisé.` });
    else if (pct >= 80) alertes.push({ niveau: "avertissement", texte: `Quota YouTube élevé : ${pct} % utilisé.` });
  }

  const maj = d.chaine && typeof d.chaine === "object" ? d.chaine.maj_chiffres : undefined;
  if (typeof maj !== "string" || Number.isNaN(Date.parse(maj))) {
    alertes.push({ niveau: "info", texte: "La date des statistiques de la chaîne est inconnue." });
  } else if (estPerime(maj, maintenant, HEURES_STATISTIQUES_PERIMEES)) {
    alertes.push({ niveau: "info", texte: `Les statistiques de la chaîne datent de plus de ${HEURES_STATISTIQUES_PERIMEES} h.` });
  }

  const videos = Array.isArray(d.videos) ? d.videos : [];
  const aVenir = videos.some((v) => v && v.programme === true && Date.parse(v.publie_pour) > maintenant.getTime());
  if (!aVenir) alertes.push({ niveau: "info", texte: "Aucune vidéo n'est programmée à venir." });

  if (Array.isArray(d.avertissements)) {
    for (const a of d.avertissements.slice(0, 10)) {
      if (typeof a === "string") alertes.push({ niveau: "avertissement", texte: `Lecture : ${a.slice(0, 200)}` });
    }
  }
  return alertes.sort((a, b) => GRAVITE[a.niveau] - GRAVITE[b.niveau]);
}

// Un lien venu des données n'est suivi que s'il mène à YouTube, en https, sans identifiants ni port.
export function lienSur(url) {
  if (typeof url !== "string" || /[\s\u0000-\u001f\u007f]/.test(url)) return null;
  try {
    const adresse = new URL(url);
    if (adresse.protocol !== "https:" || adresse.username || adresse.password || adresse.port) return null;
    return HOTES_YOUTUBE.has(adresse.hostname) ? adresse.href : null;
  } catch {
    return null;
  }
}

const idVideo = (id) => (typeof id === "string" && ID_VIDEO.test(id) ? id : null);
const idChaine = (id) => (typeof id === "string" && ID_CHAINE.test(id) ? id : null);

export const lienVideo = (id) => idVideo(id) && `https://www.youtube.com/watch?v=${id}`;
export const lienChaine = (chaineId) => idChaine(chaineId) && `https://www.youtube.com/channel/${chaineId}`;
// Le direct EN COURS : l'adresse stable de la chaîne mène toujours à la diffusion actuelle
// (l'identifiant du bilan du soir, lui, devient périmé à chaque rotation du direct).
export const lienDirect = (chaineId) => idChaine(chaineId) && `https://www.youtube.com/channel/${chaineId}/live`;
export const lienAnalytiquesVideo = (id) =>
  idVideo(id) && `https://studio.youtube.com/video/${id}/analytics/tab-overview/period-default`;
export const lienAnalytiquesChaine = (chaineId) =>
  idChaine(chaineId) && `https://studio.youtube.com/channel/${chaineId}/analytics/tab-overview/period-default`;
export const lienStudio = (chaineId, rubrique) =>
  idChaine(chaineId) && Object.hasOwn(RUBRIQUES_STUDIO, rubrique)
    ? `https://studio.youtube.com/channel/${chaineId}/${RUBRIQUES_STUDIO[rubrique]}`
    : null;

// Points d'un <polyline> (y vers le bas) ; valeurs non numériques ignorées ; « » s'il y a moins de deux points.
export function pointsCourbe(valeurs, largeur, hauteur) {
  if (!Array.isArray(valeurs) || !estNombre(largeur) || !estNombre(hauteur) || largeur <= 0 || hauteur <= 0) return "";
  const v = valeurs.filter(estNombre);
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const arrondi = (x) => String(Number(x.toFixed(1)));
  return v
    .map((valeur, i) => {
      const x = (i * largeur) / (v.length - 1);
      const y = max === min ? hauteur / 2 : hauteur - ((valeur - min) / (max - min)) * hauteur;
      return `${arrondi(x)},${arrondi(y)}`;
    })
    .join(" ");
}

// ---------- Commandes du live (étape C) ----------

const DELAIS_ATTENTE = { lancer: 6 * MINUTE, couper: 2 * MINUTE };

// « falling-pickaxe.couper » -> « couper » ; null si l'identifiant n'est pas un texte.
const suffixeAction = (id) => (typeof id === "string" ? id.split(".").pop() : null);

// L'action à proposer : « couper » quand le live tourne, « lancer » quand il est arrêté ; null si l'état est inconnu.
export function actionAffichee(enCours, actions) {
  if (typeof enCours !== "boolean" || !Array.isArray(actions)) return null;
  const voulu = enCours ? "couper" : "lancer";
  return actions.find((a) => a && typeof a === "object" && suffixeAction(a.id) === voulu) ?? null;
}

// Suivi d'une action : l'état réel du live dit si elle a réussi ; passé le délai, l'échec est dit en clair.
export function attenteTerminee(actionId, enCours, ecouleMs) {
  const suffixe = suffixeAction(actionId);
  if (!Object.hasOwn(DELAIS_ATTENTE, suffixe) || !estNombre(ecouleMs) || ecouleMs < 0) {
    return { fini: true, reussi: false, message: "Suivi impossible." };
  }
  const lancer = suffixe === "lancer";
  if (enCours === lancer) {
    return { fini: true, reussi: true, message: lancer ? "Le live est en route." : "Le live est arrêté." };
  }
  if (ecouleMs >= DELAIS_ATTENTE[suffixe]) {
    return {
      fini: true,
      reussi: false,
      message: lancer
        ? "Le live n'est pas parti : consultez le journal de Falling Pickaxe."
        : "Le live tourne toujours : le projet a peut-être refusé l'arrêt (impossible dans les 10 minutes qui suivent un démarrage).",
    };
  }
  return { fini: false, reussi: false, message: lancer ? "Démarrage en cours (1 à 3 minutes)…" : "Arrêt en cours…" };
}

export function messageApresConfirmation(statut) {
  if (statut === "simulee") return "Simulation : rien n'a été exécuté.";
  if (statut === "declenchee") return "Ordre envoyé à Windows : suivi de l'état…";
  return "Réponse inattendue du serveur.";
}

// ---------- Concours, produits, calendrier ----------

const HOTES_PLATEFORMES = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com",
  "instagram.com", "www.instagram.com", "t.me", "github.com",
]);

// Un lien venu des données (annonce, canal, dépôt) n'est suivi que s'il mène à une plateforme connue, en https, sans identifiants ni port.
export function lienPlateforme(url) {
  if (typeof url !== "string" || /[\s\u0000-\u001f\u007f]/.test(url)) return null;
  try {
    const adresse = new URL(url);
    if (adresse.protocol !== "https:" || adresse.username || adresse.password || adresse.port) return null;
    return HOTES_PLATEFORMES.has(adresse.hostname) ? adresse.href : null;
  } catch {
    return null;
  }
}

// « dans 12 min », « dans 3 h », « dans 2 j » ; « maintenant » pour moins d'une minute ou une date passée.
export function delaiAvant(iso, maintenant) {
  if (typeof iso !== "string" || Number.isNaN(Date.parse(iso))) return "date inconnue";
  const ms = Date.parse(iso) - maintenant.getTime();
  if (ms < MINUTE) return "maintenant";
  if (ms < HEURE) return `dans ${Math.floor(ms / MINUTE)} min`;
  if (ms < JOUR) return `dans ${Math.floor(ms / HEURE)} h`;
  return `dans ${Math.floor(ms / JOUR)} j`;
}

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

// Le jour civil à Paris (« 2026-10-29 »), celui du planning.
export function jourParis(date) {
  return FORMAT_JOUR_PARIS.format(date);
}

// Le planning rangé pour l'œil : en retard, aujourd'hui, à venir, fait, réserve. Les entrées illisibles sont ignorées.
export function classerCalendrier(entrees, maintenant) {
  const sortie = { retard: [], aujourdhui: [], aVenir: [], faits: [], reserve: [] };
  if (!Array.isArray(entrees)) return sortie;
  const aujourdhui = jourParis(maintenant);
  const iso = maintenant.toISOString();
  const cle = (e) => (typeof e.quand === "string" ? e.quand : e.jour);
  for (const e of entrees) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "reserve") {
      if (e.fait !== true) sortie.reserve.push(e);
      continue;
    }
    if (e.type !== "video" && e.type !== "prospection") continue;
    if (typeof e.jour !== "string" && typeof e.quand !== "string") continue;
    if (e.fait === true) sortie.faits.push(e);
    else if (typeof e.quand === "string" ? e.quand < iso : e.jour < aujourdhui) sortie.retard.push(e);
    else if (e.jour === aujourdhui) sortie.aujourdhui.push(e);
    else sortie.aVenir.push(e);
  }
  const croissant = (a, b) => (cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0);
  for (const liste of [sortie.retard, sortie.aujourdhui, sortie.aVenir]) liste.sort(croissant);
  sortie.faits.sort((a, b) => croissant(b, a));
  return sortie;
}

export function libelleOrdre(ordre) {
  if (ordre === "ok") return "Publication demandée";
  if (ordre === "no") return "Refus demandé";
  return null;
}

// « YouTube · PS5 · France · fin 2026-11-05 · score 72 » : ce qui est lisible, dans cet ordre.
export function metaCarte(carte) {
  if (!carte || typeof carte !== "object") return "";
  const texte = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return [
    texte(carte.plateforme), texte(carte.lot), texte(carte.pays),
    texte(carte.fin) && `fin ${carte.fin}`,
    estNombre(carte.score) ? `score ${carte.score}` : null,
  ].filter(Boolean).join(" · ");
}

const RANG_ALERTE = { erreur: 0, avertissement: 1, action: 2, info: 3 };

// Alertes et tâches rangées de la plus grave à la moins grave ; niveau inconnu = info ; texte vide ou trop long nettoyé.
export function trierAlertes(alertes) {
  if (!Array.isArray(alertes)) return [];
  return alertes
    .filter((a) => a && typeof a === "object" && typeof a.texte === "string" && a.texte.trim())
    .map((a) => ({ niveau: Object.hasOwn(RANG_ALERTE, a.niveau) ? a.niveau : "info", texte: a.texte.trim().slice(0, 300) }))
    .sort((a, b) => RANG_ALERTE[a.niveau] - RANG_ALERTE[b.niveau]);
}

// ---------- Revenus, agenda, tâches de tout le tableau ----------

// 790 -> « 7,90 € », 123456 -> « 1 234,56 € » ; « ? » si ce n'est pas un nombre entier de centimes raisonnable.
export function formaterMontant(centimes, symbole) {
  if (!Number.isInteger(centimes) || centimes < 0 || centimes > 10 ** 12) return "?";
  const euros = String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${euros},${String(centimes % 100).padStart(2, "0")} ${symbole}`;
}

const HORIZON_AGENDA = 14 * JOUR;
const NB_AGENDA = 6;
const objetSur = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const listeSure = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

// Les prochains rendez-vous de tous les projets : vidéos à poster, Shorts programmés, prochain passage du bot.
export function construireAgenda(projets, maintenant) {
  if (!Array.isArray(projets)) return [];
  const debut = maintenant.getTime();
  const evenements = [];
  const ajouter = (quand, source, texte) => {
    const t = typeof quand === "string" ? Date.parse(quand) : NaN;
    if (!Number.isNaN(t) && t >= debut && t <= debut + HORIZON_AGENDA) evenements.push({ quand, source, texte });
  };
  for (const p of projets) {
    if (!p || typeof p !== "object") continue;
    const nom = typeof p.nom === "string" ? p.nom : "Projet";
    const d = objetSur(p.details);
    if (p.adaptateur === "produits-numeriques") {
      for (const e of listeSure(d.calendrier)) {
        if (e.type === "video" && e.fait !== true) ajouter(e.quand, nom, `Poster « ${typeof e.format === "string" ? e.format : "vidéo"} »${typeof e.id === "string" ? ` (${e.id})` : ""}`);
      }
    } else if (p.adaptateur === "falling-pickaxe") {
      for (const v of listeSure(d.videos)) {
        if (v.programme === true) ajouter(v.publie_pour, nom, `Short programmé : ${typeof v.titre === "string" ? v.titre : "(sans titre)"}`);
      }
    } else if (p.adaptateur === "bot-concours") {
      const passages = Array.isArray(d.passages) ? d.passages : [];
      ajouter(passages[0], nom, "Passage du bot (nouvelles cartes à valider, ordres appliqués)");
    }
  }
  return evenements.sort((a, b) => Date.parse(a.quand) - Date.parse(b.quand)).slice(0, NB_AGENDA);
}

const TEXTES_GUMROAD = {
  "a-configurer": ["action", "créer le jeton d'accès Gumroad pour voir les ventes et le revenu."],
  "jeton-invalide": ["action", "le fichier du jeton Gumroad n'a pas la bonne forme."],
  refuse: ["avertissement", "Gumroad a refusé le jeton : en créer un nouveau."],
  erreur: ["avertissement", "Gumroad ne répond pas pour le moment."],
};

const NOM_COURT = { "bot-concours": "Concours", "produits-numeriques": "Produits", tiktok: "TikTok", gumroad: "Gumroad", "falling-pickaxe": "Live" };

// Tout ce qu'il reste à faire ou à surveiller, de tous les projets, du plus grave au moins grave.
export function tachesDuTableau(projets) {
  if (!Array.isArray(projets)) return [];
  const taches = [];
  for (const p of projets) {
    if (!p || typeof p !== "object") continue;
    const nom = Object.hasOwn(NOM_COURT, p.adaptateur) ? NOM_COURT[p.adaptateur] : typeof p.nom === "string" ? p.nom : "Projet";
    const d = objetSur(p.details);
    for (const a of listeSure(d.a_faire)) taches.push({ niveau: a.niveau, texte: `${nom} : ${typeof a.texte === "string" ? a.texte : ""}` });
    for (const texte of Array.isArray(d.avertissements) ? d.avertissements : []) {
      if (typeof texte === "string") taches.push({ niveau: "avertissement", texte: `${nom} : ${texte}` });
    }
    if (p.adaptateur === "gumroad" && Object.hasOwn(TEXTES_GUMROAD, d.etat)) {
      const [niveau, texte] = TEXTES_GUMROAD[d.etat];
      taches.push({ niveau, texte: `${nom} : ${texte}` });
    }
  }
  return trierAlertes(taches);
}

// Liens venus de l'API Gumroad et des exports TikTok : seulement leurs propres domaines, en https, sans identifiants ni port.
function lienDuDomaine(url, accepte) {
  if (typeof url !== "string" || /[\s\u0000-\u001f\u007f]/.test(url)) return null;
  try {
    const adresse = new URL(url);
    if (adresse.protocol !== "https:" || adresse.username || adresse.password || adresse.port) return null;
    return accepte(adresse.hostname) ? adresse.href : null;
  } catch {
    return null;
  }
}

export const lienGumroad = (url) => lienDuDomaine(url, (h) => h === "gumroad.com" || h.endsWith(".gumroad.com"));
export const lienTiktok = (url) => lienDuDomaine(url, (h) => h === "tiktok.com" || h.endsWith(".tiktok.com"));

// ---------- Onglets : la page ne montre qu'un thème à la fois (moins de défilement sur téléphone) ----------

export const ONGLETS = [
  { id: "resume", titre: "Résumé" },
  { id: "concours", titre: "Concours" },
  { id: "produits", titre: "Produits" },
  { id: "tiktok", titre: "TikTok" },
  { id: "argent", titre: "Argent" },
  { id: "live", titre: "Live" },
  { id: "autres", titre: "Autres" },
];
const ONGLET_DE = { "bot-concours": "concours", "produits-numeriques": "produits", tiktok: "tiktok", gumroad: "argent", "falling-pickaxe": "live" };

// Les projets rangés par onglet, dans l'ordre fixe de ONGLETS ; un onglet sans projet n'existe pas, sauf « Résumé » et ceux
// demandés en plus (ex. « argent » pour le carnet de revenus, qui n'est pas un projet).
export function rangerEnOnglets(projets, extras = []) {
  const par = new Map(ONGLETS.map((o) => [o.id, []]));
  for (const p of Array.isArray(projets) ? projets : []) {
    if (!p || typeof p !== "object") continue;
    par.get(Object.hasOwn(ONGLET_DE, p.adaptateur) ? ONGLET_DE[p.adaptateur] : "autres").push(p);
  }
  const voulus = new Set(Array.isArray(extras) ? extras : []);
  return ONGLETS
    .filter((o) => o.id === "resume" || par.get(o.id).length > 0 || voulus.has(o.id))
    .map((o) => ({ ...o, projets: par.get(o.id) }));
}

// Une petite pastille sur l'onglet quand quelque chose demande l'attention ; null sinon. Ne plante jamais.
export function pastilleOnglet(id, projets) {
  const liste = Array.isArray(projets) ? projets.filter((p) => p && typeof p === "object") : [];
  const de = (adaptateur) => liste.filter((p) => p.adaptateur === adaptateur).map((p) => objetSur(p.details));
  if (id === "resume") {
    const n = tachesDuTableau(liste).filter((t) => t.niveau !== "info").length;
    return n > 0 ? { texte: String(n), niveau: "attention" } : null;
  }
  if (id === "concours") {
    const n = de("bot-concours").reduce((somme, d) => {
      const c = objetSur(d.compteurs);
      return somme + (estNombre(c.cartes) && estNombre(c.acceptees) ? Math.max(0, c.cartes - c.acceptees) : 0);
    }, 0);
    return n > 0 ? { texte: String(n), niveau: "info" } : null;
  }
  if (id === "produits") {
    const n = de("produits-numeriques").reduce((somme, d) => somme + (estNombre(objetSur(d.compteurs).en_retard) ? Math.max(0, d.compteurs.en_retard) : 0), 0);
    return n > 0 ? { texte: String(n), niveau: "attention" } : null;
  }
  if (id === "live") return de("falling-pickaxe").some((d) => objetSur(d.live).en_cours === true) ? { texte: "●", niveau: "ok" } : null;
  if (id === "argent") return de("gumroad").some((d) => d.etat !== "ok") ? { texte: "!", niveau: "attention" } : null;
  if (id === "tiktok") return de("tiktok").some((d) => listeSure(d.comptes).length === 0) ? { texte: "!", niveau: "attention" } : null;
  return null;
}

// ---------- Produits locaux et boutique Gumroad ----------

const normaliserTitre = (t) => (typeof t === "string" ? t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "");
const LONGUEUR_MIN_TITRE = 20; // un titre plus court est trop vague pour désigner un produit

function memeProduit(a, b) {
  if (a.length < LONGUEUR_MIN_TITRE || b.length < LONGUEUR_MIN_TITRE) return false;
  return a === b || a.startsWith(b) || b.startsWith(a) || a.slice(0, 40) === b.slice(0, 40);
}

// Quel dossier local est en ligne sur la boutique Gumroad ? Rapprochement par titre (accents, casse et ponctuation ignorés).
// parLocal[id] = { produit (de la boutique ou null), prixIdentique (true, false, ou null si impossible à comparer) } ;
// sansDossier = produits de la boutique qui n'ont pas de dossier local.
export function rapprocherProduits(locaux, boutique) {
  const enBoutique = listeSure(objetSur(boutique).produits).filter((p) => typeof p.permalink === "string" && typeof p.nom === "string");
  const pris = new Set();
  const parLocal = {};
  for (const l of Array.isArray(locaux) ? locaux : []) {
    if (!l || typeof l !== "object" || typeof l.id !== "string") continue;
    const titre = normaliserTitre(l.titre);
    const produit = enBoutique.find((p) => !pris.has(p.permalink) && memeProduit(titre, normaliserTitre(p.nom))) ?? null;
    if (produit) pris.add(produit.permalink);
    const comparable = produit && estNombre(l.prix_eur) && produit.devise === "EUR" && Number.isInteger(produit.prix_cents);
    parLocal[l.id] = { produit, prixIdentique: comparable ? Math.round(l.prix_eur * 100) === produit.prix_cents : null };
  }
  return { parLocal, sansDossier: enBoutique.filter((p) => !pris.has(p.permalink)) };
}

// ---------- Boîte aux ordres GitHub (page en ligne) ----------

// « https://github.com/moi/depot » -> « moi/depot » ; null pour toute autre adresse.
export function depotDepuisLien(url) {
  if (typeof url !== "string") return null;
  const trouve = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/?$/.exec(url);
  return trouve && trouve[2] !== "." && trouve[2] !== ".." ? `${trouve[1]}/${trouve[2]}` : null;
}

// Seule une clé « fine-grained » est acceptée : limitée à un dépôt et à une permission, elle ne peut rien faire d'autre que créer des tickets.
// Une clé classique (ghp_…) ouvre tous les dépôts du compte : on la refuse.
export function cleGithubValide(texte) {
  return typeof texte === "string" && /^github_pat_[A-Za-z0-9_]{20,250}$/.test(texte);
}

const MESSAGES_GITHUB = {
  401: "La clé GitHub est refusée ou expirée : recrée-en une et enregistre-la de nouveau.",
  403: "La clé n'a pas le droit de créer des tickets sur ce dépôt : vérifie la permission « Issues » (lecture et écriture).",
  404: "Dépôt introuvable pour cette clé : elle doit être limitée au dépôt du bot, avec la permission « Issues ».",
  410: "Les tickets sont désactivés sur le dépôt du bot : active-les dans les réglages du dépôt (Features, Issues).",
  422: "GitHub a refusé l'ordre (ticket invalide ou tickets désactivés).",
  429: "GitHub demande de ralentir : réessaie dans une minute.",
};

export function messageErreurGithub(statut) {
  return Object.hasOwn(MESSAGES_GITHUB, statut) ? MESSAGES_GITHUB[statut] : "GitHub n'a pas pris l'ordre en compte : réessaie dans un moment.";
}

// La clé GitHub des ordres : celle que le tableau fournit avec les données chiffrées (rien à recopier sur le téléphone), sinon celle
// enregistrée sur l'appareil. Une clé de mauvaise forme n'est jamais utilisée.
export function choisirCleGithub(charge, stockee) {
  const fournie = charge && typeof charge === "object" ? charge.cle_github : null;
  if (cleGithubValide(fournie)) return { cle: fournie, origine: "donnees" };
  if (cleGithubValide(stockee)) return { cle: stockee, origine: "appareil" };
  return null;
}
