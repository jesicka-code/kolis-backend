// server.js — le serveur de Kolis, connecté à MongoDB

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

const MONGO_URI = process.env.MONGO_URI;

const client = new MongoClient(MONGO_URI);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db("kolis");
    console.log("✅ Connecté à MongoDB avec succès !");
  } catch (error) {
    console.error("❌ Erreur de connexion à MongoDB :", error);
  }
}

connectToDatabase();

function calculerDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const FRAIS_BASE = 300;
const TARIF_PAR_KM = 200;

function calculerFraisLivraison(distanceKm) {
  return Math.round(FRAIS_BASE + TARIF_PAR_KM * distanceKm);
}

const TAUX_COMMISSION = 0.10;

// ---------- Route de test ----------
app.get("/", (req, res) => {
  res.send("Bienvenue sur le serveur de Kolis ! 🛵");
});

// ---------- Commerces ----------
app.get("/commerces", async (req, res) => {
  try {
    const commerces = await db.collection("commerces").find().toArray();
    const avisCollection = db.collection("avis");

    const commercesAvecNote = await Promise.all(
      commerces.map(async (commerce) => {
        const avisDuCommerce = await avisCollection.find({ commerceNom: commerce.nom }).toArray();
        if (avisDuCommerce.length > 0) {
          const somme = avisDuCommerce.reduce((total, avis) => total + avis.noteCommerce, 0);
          commerce.note = Math.round((somme / avisDuCommerce.length) * 10) / 10;
          commerce.nombreAvis = avisDuCommerce.length;
        } else {
          commerce.nombreAvis = 0;
        }
        return commerce;
      })
    );

    res.json(commercesAvecNote);
  } catch (error) {
    console.error("Erreur lors de la récupération des commerces :", error);
    res.status(500).json({ erreur: "Impossible de récupérer les commerces" });
  }
});

app.get("/commerces/populaires", async (req, res) => {
  try {
    const commerces = await db.collection("commerces").find().toArray();
    const avisCollection = db.collection("avis");

    const commercesAvecNote = await Promise.all(
      commerces.map(async (commerce) => {
        const avisDuCommerce = await avisCollection.find({ commerceNom: commerce.nom }).toArray();
        if (avisDuCommerce.length > 0) {
          const somme = avisDuCommerce.reduce((total, avis) => total + avis.noteCommerce, 0);
          commerce.note = Math.round((somme / avisDuCommerce.length) * 10) / 10;
        }
        return commerce;
      })
    );

    commercesAvecNote.sort((a, b) => b.note - a.note);
    res.json(commercesAvecNote.slice(0, 4));
  } catch (error) {
    console.error("Erreur lors de la récupération des commerces populaires :", error);
    res.status(500).json({ erreur: "Impossible de récupérer les commerces populaires" });
  }
});

// ---------- Produits ----------
app.get("/produits", async (req, res) => {
  try {
    const { commerce } = req.query;
    const filtre = commerce ? { commerceNom: commerce } : {};
    const produits = await db.collection("produits").find(filtre).toArray();
    res.json(produits);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    res.status(500).json({ erreur: "Impossible de récupérer les produits" });
  }
});

app.post("/produits", async (req, res) => {
  try {
    const { commerceNom, nom, categorie, unite, prix } = req.body;

    if (!commerceNom || !nom || !unite || !prix) {
      return res.status(400).json({ erreur: "commerceNom, nom, unite et prix sont obligatoires." });
    }

    const produit = {
      commerceNom, nom,
      categorie: categorie || "epicerie",
      unite, prix: parseInt(prix, 10),
      disponible: true,
    };

    const resultat = await db.collection("produits").insertOne(produit);
    res.status(201).json({ message: "Produit ajouté", produitId: resultat.insertedId });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible d'ajouter le produit" });
  }
});

app.patch("/produits/:id", async (req, res) => {
  try {
    const { disponible } = req.body;
    await db.collection("produits").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { disponible } }
    );
    res.json({ message: "Produit mis à jour" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour le produit" });
  }
});

app.delete("/produits/:id", async (req, res) => {
  try {
    await db.collection("produits").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Produit supprimé" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de supprimer le produit" });
  }
});

// ---------- Recherche ----------
app.get("/recherche", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ erreur: "Le paramètre de recherche q est obligatoire." });
    }

    const regex = new RegExp(q, "i");

    const commercesParNom = await db.collection("commerces").find({ nom: regex }).toArray();

    const produitsTrouves = await db.collection("produits").find({ nom: regex, disponible: { $ne: false } }).toArray();
    const nomsCommercesViaProduits = [...new Set(produitsTrouves.map(function (p) { return p.commerceNom; }))];

    const commercesParProduit = await db.collection("commerces")
      .find({ nom: { $in: nomsCommercesViaProduits } })
      .toArray();

    const resultats = [];
    const nomsDejaAjoutes = new Set();

    commercesParNom.forEach(function (commerce) {
      if (!nomsDejaAjoutes.has(commerce.nom)) {
        resultats.push({ ...commerce, produitTrouve: null });
        nomsDejaAjoutes.add(commerce.nom);
      }
    });

    commercesParProduit.forEach(function (commerce) {
      const produitCorrespondant = produitsTrouves.find(function (p) { return p.commerceNom === commerce.nom; });
      if (!nomsDejaAjoutes.has(commerce.nom)) {
        resultats.push({ ...commerce, produitTrouve: produitCorrespondant ? produitCorrespondant.nom : null });
        nomsDejaAjoutes.add(commerce.nom);
      }
    });

    res.json(resultats);
  } catch (error) {
    console.error("Erreur lors de la recherche :", error);
    res.status(500).json({ erreur: "Impossible d'effectuer la recherche" });
  }
});

// ---------- Livraison ----------
app.get("/calculer-livraison", (req, res) => {
  const { latCommerce, lonCommerce, latClient, lonClient } = req.query;

  if (!latCommerce || !lonCommerce || !latClient || !lonClient) {
    return res.status(400).json({
      erreur: "Il manque des coordonnées. Attendu : latCommerce, lonCommerce, latClient, lonClient",
    });
  }

  const distance = calculerDistanceKm(
    parseFloat(latCommerce),
    parseFloat(lonCommerce),
    parseFloat(latClient),
    parseFloat(lonClient)
  );

  const frais = calculerFraisLivraison(distance);

  res.json({
    distanceKm: Math.round(distance * 10) / 10,
    fraisLivraison: frais,
  });
});

// ---------- Commandes ----------
app.post("/commandes", async (req, res) => {
  try {
    const { commerceId, commerceNom, articles, latCommerce, lonCommerce, latClient, lonClient, adresseLivraison, modePaiement, montantRemis } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({ erreur: "La commande doit contenir au moins un article." });
    }

    const sousTotal = articles.reduce((total, article) => total + article.prix * article.quantite, 0);

    const distance = calculerDistanceKm(
      parseFloat(latCommerce),
      parseFloat(lonCommerce),
      parseFloat(latClient),
      parseFloat(lonClient)
    );
    const fraisLivraison = calculerFraisLivraison(distance);

    const commissionKolis = Math.round(sousTotal * TAUX_COMMISSION);
    const montantCommerce = sousTotal - commissionKolis;

    const totalClient = sousTotal + fraisLivraison;

    let monnaieARendre = 0;
    if (modePaiement === "especes" && montantRemis) {
      monnaieARendre = Math.max(0, parseInt(montantRemis, 10) - totalClient);
    }

    const commande = {
      commerceId,
      commerceNom,
      articles,
      adresseLivraison,
      modePaiement,
      latCommerce: parseFloat(latCommerce),
      lonCommerce: parseFloat(lonCommerce),
      latClient: parseFloat(latClient),
      lonClient: parseFloat(lonClient),
      distanceKm: Math.round(distance * 10) / 10,
      sousTotal,
      fraisLivraison,
      commissionKolis,
      montantCommerce,
      totalClient,
      statut: "nouvelle",
      paiementStatut: "en_attente",
      montantRemis: montantRemis ? parseInt(montantRemis, 10) : null,
      monnaieARendre: monnaieARendre,
      reverseAKolis: false,
      reverseAuCommerce: false,
      dateCreation: new Date(),
    };

    const resultat = await db.collection("commandes").insertOne(commande);

    res.status(201).json({
      message: "Commande créée avec succès",
      commandeId: resultat.insertedId,
      ...commande,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la commande :", error);
    res.status(500).json({ erreur: "Impossible de créer la commande" });
  }
});

app.get("/commandes", async (req, res) => {
  try {
    const { commerce } = req.query;
    const filtre = commerce ? { commerceNom: commerce } : {};
    const commandes = await db.collection("commandes")
      .find(filtre)
      .sort({ dateCreation: -1 })
      .toArray();
    res.json(commandes);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer les commandes" });
  }
});

app.get("/commandes/disponibles", async (req, res) => {
  try {
    const commandes = await db.collection("commandes").find({ statut: "prete" }).toArray();
    res.json(commandes);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer les commandes disponibles" });
  }
});

app.get("/commandes/especes", async (req, res) => {
  try {
    const commandes = await db.collection("commandes")
      .find({ modePaiement: "especes" })
      .sort({ dateCreation: -1 })
      .toArray();
    res.json(commandes);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer les commandes en espèces" });
  }
});

app.get("/commandes/:id", async (req, res) => {
  try {
    const commande = await db.collection("commandes").findOne({ _id: new ObjectId(req.params.id) });
    if (!commande) return res.status(404).json({ erreur: "Commande introuvable" });
    res.json(commande);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer la commande" });
  }
});

app.patch("/commandes/:id", async (req, res) => {
  try {
    const { statut, livreurNom } = req.body;
    const misAJour = {};
    if (statut) misAJour.statut = statut;
    if (livreurNom) misAJour.livreurNom = livreurNom;

    await db.collection("commandes").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: misAJour }
    );
    res.json({ message: "Commande mise à jour" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour la commande" });
  }
});

app.patch("/commandes/:id/paiement-recu", async (req, res) => {
  try {
    await db.collection("commandes").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { paiementStatut: "paye", datePaiement: new Date() } }
    );
    res.json({ message: "Paiement confirmé" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de confirmer le paiement" });
  }
});

// ---------- Solde des livreurs (espèces à reverser) ----------
app.get("/livreurs/soldes", async (req, res) => {
  try {
    const commandesEspeces = await db.collection("commandes")
      .find({ modePaiement: "especes", paiementStatut: "paye", reverseAKolis: false })
      .toArray();

    const soldesParLivreur = {};

    commandesEspeces.forEach(function (commande) {
      const nom = commande.livreurNom || "Non assigné";
      if (!soldesParLivreur[nom]) {
        soldesParLivreur[nom] = { livreurNom: nom, montantAReverser: 0, nombreCommandes: 0 };
      }
      soldesParLivreur[nom].montantAReverser += commande.sousTotal;
      soldesParLivreur[nom].nombreCommandes += 1;
    });

    res.json(Object.values(soldesParLivreur));
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de calculer les soldes" });
  }
});

app.patch("/livreurs/:nom/reverser", async (req, res) => {
  try {
    await db.collection("commandes").updateMany(
      { livreurNom: req.params.nom, modePaiement: "especes", paiementStatut: "paye", reverseAKolis: false },
      { $set: { reverseAKolis: true, dateReversement: new Date() } }
    );
    res.json({ message: "Montant marqué comme reversé" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour le reversement" });
  }
});

// ---------- Solde des commerces (ce que Kolis leur doit reverser) ----------
app.get("/commerces/soldes", async (req, res) => {
  try {
    const commandesAPayer = await db.collection("commandes")
      .find({
        paiementStatut: "paye",
        reverseAuCommerce: { $ne: true },
      })
      .toArray();

    const soldesParCommerce = {};

    commandesAPayer.forEach(function (commande) {
      const nom = commande.commerceNom;
      if (!soldesParCommerce[nom]) {
        soldesParCommerce[nom] = { commerceNom: nom, montantAReverser: 0, nombreCommandes: 0 };
      }
      soldesParCommerce[nom].montantAReverser += commande.montantCommerce;
      soldesParCommerce[nom].nombreCommandes += 1;
    });

    res.json(Object.values(soldesParCommerce));
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de calculer les soldes des commerces" });
  }
});

app.patch("/commerces/:nom/reverser", async (req, res) => {
  try {
    await db.collection("commandes").updateMany(
      {
        commerceNom: req.params.nom,
        paiementStatut: "paye",
        reverseAuCommerce: { $ne: true },
      },
      { $set: { reverseAuCommerce: true, dateReversementCommerce: new Date() } }
    );
    res.json({ message: "Montant marqué comme reversé au commerce" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour le reversement" });
  }
});

// Le commerce change son statut ouvert/fermé
app.patch("/commerces/:nom/statut", async (req, res) => {
  try {
    const { ouvert } = req.body;
    await db.collection("commerces").updateOne(
      { nom: req.params.nom },
      { $set: { ouvert: ouvert } }
    );
    res.json({ message: "Statut mis à jour" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour le statut" });
  }
});

// ---------- Avis ----------
app.post("/avis", async (req, res) => {
  try {
    const { commerceNom, noteCommerce, noteLivreur, commentaire } = req.body;

    if (!commerceNom || !noteCommerce || !noteLivreur) {
      return res.status(400).json({ erreur: "commerceNom, noteCommerce et noteLivreur sont obligatoires." });
    }

    const avis = {
      commerceNom,
      noteCommerce: parseInt(noteCommerce, 10),
      noteLivreur: parseInt(noteLivreur, 10),
      commentaire: commentaire || "",
      dateCreation: new Date(),
    };

    await db.collection("avis").insertOne(avis);

    res.status(201).json({ message: "Avis enregistré avec succès", avis });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'avis :", error);
    res.status(500).json({ erreur: "Impossible d'enregistrer l'avis" });
  }
});

// ---------- Comptes clients ----------
app.post("/inscription", async (req, res) => {
  try {
    const { nom, telephone, email, motDePasse } = req.body;

    if (!nom || !telephone || !motDePasse) {
      return res.status(400).json({ erreur: "Nom, téléphone et mot de passe sont obligatoires." });
    }

    const comptesCollection = db.collection("comptes");

    const compteExistant = await comptesCollection.findOne({ telephone });
    if (compteExistant) {
      return res.status(409).json({ erreur: "Un compte existe déjà avec ce numéro de téléphone." });
    }

    const motDePasseChiffre = await bcrypt.hash(motDePasse, 10);

    const nouveauCompte = {
      nom,
      telephone,
      email: email || "",
      motDePasse: motDePasseChiffre,
      dateCreation: new Date(),
    };

    const resultat = await comptesCollection.insertOne(nouveauCompte);

    res.status(201).json({
      message: "Compte créé avec succès",
      compteId: resultat.insertedId,
      nom: nouveauCompte.nom,
      telephone: nouveauCompte.telephone,
      email: nouveauCompte.email,
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    res.status(500).json({ erreur: "Impossible de créer le compte" });
  }
});

app.post("/connexion", async (req, res) => {
  try {
    const { telephone, motDePasse } = req.body;

    if (!telephone || !motDePasse) {
      return res.status(400).json({ erreur: "Téléphone et mot de passe sont obligatoires." });
    }

    const comptesCollection = db.collection("comptes");
    const compte = await comptesCollection.findOne({ telephone });

    if (!compte) {
      return res.status(401).json({ erreur: "Aucun compte trouvé avec ce numéro de téléphone." });
    }

    const motDePasseValide = await bcrypt.compare(motDePasse, compte.motDePasse);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: "Mot de passe incorrect." });
    }

    res.json({
      message: "Connexion réussie",
      compteId: compte._id,
      nom: compte.nom,
      telephone: compte.telephone,
      email: compte.email,
    });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    res.status(500).json({ erreur: "Impossible de se connecter" });
  }
});

// ---------- Candidatures livreurs ----------
app.post("/candidatures/livreurs", async (req, res) => {
  try {
    const { nom, telephone, vehicule } = req.body;

    if (!nom || !telephone || !vehicule) {
      return res.status(400).json({ erreur: "Nom, téléphone et véhicule sont obligatoires." });
    }

    const candidature = {
      nom, telephone, vehicule,
      statut: "attente",
      dateCreation: new Date(),
    };

    const resultat = await db.collection("candidatures_livreurs").insertOne(candidature);
    res.status(201).json({ message: "Candidature envoyée", candidatureId: resultat.insertedId });
  } catch (error) {
    console.error("Erreur candidature livreur :", error);
    res.status(500).json({ erreur: "Impossible d'envoyer la candidature" });
  }
});

app.get("/candidatures/livreurs", async (req, res) => {
  try {
    const candidatures = await db.collection("candidatures_livreurs").find({ statut: "attente" }).toArray();
    res.json(candidatures);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer les candidatures" });
  }
});

app.patch("/candidatures/livreurs/:id", async (req, res) => {
  try {
    const { statut } = req.body;
    await db.collection("candidatures_livreurs").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { statut } }
    );
    res.json({ message: "Candidature mise à jour" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour la candidature" });
  }
});

// ---------- Candidatures commerces (partenaires) ----------
app.post("/candidatures/commerces", async (req, res) => {
  try {
    const { nomCommerce, categorie, adresse, responsable, telephone } = req.body;

    if (!nomCommerce || !categorie || !adresse || !responsable || !telephone) {
      return res.status(400).json({ erreur: "Tous les champs obligatoires doivent être remplis." });
    }

    const candidature = {
      nomCommerce, categorie, adresse, responsable, telephone,
      statut: "attente",
      dateCreation: new Date(),
    };

    const resultat = await db.collection("candidatures_commerces").insertOne(candidature);
    res.status(201).json({ message: "Demande envoyée", candidatureId: resultat.insertedId });
  } catch (error) {
    console.error("Erreur candidature commerce :", error);
    res.status(500).json({ erreur: "Impossible d'envoyer la demande" });
  }
});

app.get("/candidatures/commerces", async (req, res) => {
  try {
    const candidatures = await db.collection("candidatures_commerces").find({ statut: "attente" }).toArray();
    res.json(candidatures);
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de récupérer les demandes" });
  }
});

app.patch("/candidatures/commerces/:id", async (req, res) => {
  try {
    const { statut } = req.body;
    await db.collection("candidatures_commerces").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { statut } }
    );
    res.json({ message: "Demande mise à jour" });
  } catch (error) {
    res.status(500).json({ erreur: "Impossible de mettre à jour la demande" });
  }
});

// ---------- Paiement Mobile Money via GeniusPay ----------

const GENIUSPAY_API_KEY = process.env.GENIUSPAY_API_KEY;
const GENIUSPAY_API_SECRET = process.env.GENIUSPAY_API_SECRET;
const GENIUSPAY_WEBHOOK_SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET;

app.post("/commandes/:id/payer", async (req, res) => {
  try {
    const commande = await db.collection("commandes").findOne({ _id: new ObjectId(req.params.id) });
    if (!commande) {
      return res.status(404).json({ erreur: "Commande introuvable" });
    }

    const reponseGeniusPay = await fetch("https://pay.genius.ci/api/v1/merchant/payments", {
      method: "POST",
      headers: {
        "X-API-Key": GENIUSPAY_API_KEY,
        "X-API-Secret": GENIUSPAY_API_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: commande.totalClient,
        description: "Commande Kolis chez " + commande.commerceNom,
        metadata: {
          order_id: commande._id.toString(),
        },
         success_url: "https://marvelous-dodol-c8532b.netlify.app/suivi-commande.html",
        error_url: "https://marvelous-dodol-c8532b.netlify.app/panier.html",
      }),
    });

    const donneesPaiement = await reponseGeniusPay.json();

    if (!donneesPaiement.success) {
      return res.status(400).json({ erreur: "Impossible de créer le paiement GeniusPay" });
    }

    await db.collection("commandes").updateOne(
      { _id: commande._id },
      { $set: { referenceGeniusPay: donneesPaiement.data.reference } }
    );

    res.json({
      checkoutUrl: donneesPaiement.data.checkout_url,
      reference: donneesPaiement.data.reference,
    });
  } catch (error) {
    console.error("Erreur lors de la création du paiement GeniusPay :", error);
    res.status(500).json({ erreur: "Impossible de créer le paiement" });
  }
});

app.post("/webhooks/geniuspay", async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const evenement = req.headers["x-webhook-event"];

    const crypto = require("crypto");
    const donneesAVerifier = timestamp + "." + req.rawBody;
    const signatureAttendue = crypto
      .createHmac("sha256", GENIUSPAY_WEBHOOK_SECRET)
      .update(donneesAVerifier)
      .digest("hex");

    if (signature !== signatureAttendue) {
      console.warn("⚠️ Signature webhook invalide, requête ignorée");
      return res.status(401).json({ erreur: "Signature invalide" });
    }

    const transaction = req.body.data;
    const commandeId = transaction.metadata && transaction.metadata.order_id;

    if (!commandeId) {
      return res.status(400).json({ erreur: "order_id manquant dans les metadata" });
    }

    if (evenement === "payment.success") {
      const commande = await db.collection("commandes").findOne({ _id: new ObjectId(commandeId) });
      const commissionNette = commande.commissionKolis - transaction.fees;

      await db.collection("commandes").updateOne(
        { _id: new ObjectId(commandeId) },
        {
          $set: {
            paiementStatut: "paye",
            fraisGeniusPay: transaction.fees,
            commissionNette: commissionNette,
            datePaiement: new Date(),
          },
        }
      );
      console.log("✅ Paiement Mobile Money confirmé pour la commande " + commandeId);
    } else if (evenement === "payment.failed") {
      await db.collection("commandes").updateOne(
        { _id: new ObjectId(commandeId) },
        { $set: { paiementStatut: "echoue" } }
      );
      console.log("❌ Paiement Mobile Money échoué pour la commande " + commandeId);
    }

    res.status(200).json({ recu: true });
  } catch (error) {
    console.error("Erreur lors du traitement du webhook GeniusPay :", error);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur Kolis démarré sur http://localhost:${PORT}`);
});