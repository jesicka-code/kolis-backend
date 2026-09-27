// server.js — le serveur de Kolis, connecté à MongoDB

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors()); // autorise le site web à communiquer avec ce serveur
app.use(express.json());

const MONGO_URI = "mongodb+srv://amanijessica961_db_user:OLiR8BKgmAx0Iyqo@cluster0.bdt6cdn.mongodb.net/?appName=Cluster0";

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

app.get("/", (req, res) => {
  res.send("Bienvenue sur le serveur de Kolis ! 🛵");
});

app.get("/commerces", async (req, res) => {
  try {
    const commerces = await db.collection("commerces").find().toArray();
    res.json(commerces);
  } catch (error) {
    console.error("Erreur lors de la récupération des commerces :", error);
    res.status(500).json({ erreur: "Impossible de récupérer les commerces" });
  }
});

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

app.post("/commandes", async (req, res) => {
  try {
    const { commerceId, commerceNom, articles, latCommerce, lonCommerce, latClient, lonClient, adresseLivraison, modePaiement } = req.body;

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

    const commande = {
      commerceId,
      commerceNom,
      articles,
      adresseLivraison,
      modePaiement,
      distanceKm: Math.round(distance * 10) / 10,
      sousTotal,
      fraisLivraison,
      commissionKolis,
      montantCommerce,
      totalClient,
      statut: "confirmee",
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur Kolis démarré sur http://localhost:${PORT}`);
});