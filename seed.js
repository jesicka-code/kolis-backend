// seed.js — remplit la base de données avec des commerces d'exemple

const { MongoClient } = require("mongodb");

// ⚠️ La même chaîne de connexion que dans server.js
const MONGO_URI = "mongodb+srv://amanijessica961_db_user:OLiR8BKgmAx0Iyqo@cluster0.bdt6cdn.mongodb.net/?appName=Cluster0";

const commercesDeDepart = [
  {
    nom: "Auchan Yamoussoukro",
    categorie: "supermarche",
    note: 4.7,
    fraisLivraison: 500,
    dureeLivraison: "25-35 min",
  },
  {
    nom: "Sococé",
    categorie: "supermarche",
    note: 4.5,
    fraisLivraison: 500,
    dureeLivraison: "30-40 min",
  },
  {
    nom: "Le Capitole",
    categorie: "restaurant",
    note: 4.6,
    fraisLivraison: 700,
    dureeLivraison: "30-40 min",
  },
  {
    nom: "Pharmacie de la Paix",
    categorie: "pharmacie",
    note: 4.4,
    fraisLivraison: 500,
    dureeLivraison: "25-35 min",
  },
  {
    nom: "Chez Tantie Maquis",
    categorie: "restaurant",
    note: 4.8,
    fraisLivraison: 500,
    dureeLivraison: "20-30 min",
  },
];

async function remplirLaBase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("Connecté à MongoDB, ajout des commerces...");

    const db = client.db("kolis");
    const collection = db.collection("commerces");

    // On vide d'abord la collection pour éviter les doublons si on relance ce script
    await collection.deleteMany({});

    // On insère les commerces d'exemple
    const resultat = await collection.insertMany(commercesDeDepart);

    console.log(`✅ ${resultat.insertedCount} commerces ajoutés avec succès !`);
  } catch (error) {
    console.error("❌ Erreur :", error);
  } finally {
    await client.close();
  }
}

remplirLaBase();