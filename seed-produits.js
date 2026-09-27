// seed-produits.js — remplit la base de données avec les produits d'Auchan Yamoussoukro

const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb+srv://amanijessica961_db_user:OLiR8BKgmAx0Iyqo@cluster0.bdt6cdn.mongodb.net/?appName=Cluster0";

const produitsDeDepart = [
  { commerceNom: "Auchan Yamoussoukro", nom: "Ananas", categorie: "fruits", unite: "1 pièce", prix: 1000 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Banane plantain", categorie: "fruits", unite: "1 kg", prix: 600 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Mangue", categorie: "fruits", unite: "1 kg", prix: 800 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Eau minérale", categorie: "boissons", unite: "1,5 L", prix: 400 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Jus de gingembre", categorie: "boissons", unite: "1 L", prix: 700 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Riz local", categorie: "epicerie", unite: "1 kg", prix: 900 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Huile végétale", categorie: "epicerie", unite: "1 L", prix: 1200 },
  { commerceNom: "Auchan Yamoussoukro", nom: "Tomates en boîte", categorie: "epicerie", unite: "400 g", prix: 500 },
];

async function remplirLaBase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("Connecté à MongoDB, ajout des produits...");

    const db = client.db("kolis");
    const collection = db.collection("produits");

    await collection.deleteMany({});
    const resultat = await collection.insertMany(produitsDeDepart);

    console.log(`✅ ${resultat.insertedCount} produits ajoutés avec succès !`);
  } catch (error) {
    console.error("❌ Erreur :", error);
  } finally {
    await client.close();
  }
}

remplirLaBase();