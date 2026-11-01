// supprimer-demo.js — supprime tous les commerces, produits et avis de démonstration

const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;

async function supprimerDonneesDemo() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db("kolis");

    const resultatCommerces = await db.collection("commerces").deleteMany({});
    const resultatProduits = await db.collection("produits").deleteMany({});
    const resultatAvis = await db.collection("avis").deleteMany({});

    console.log(`✅ ${resultatCommerces.deletedCount} commerces supprimés`);
    console.log(`✅ ${resultatProduits.deletedCount} produits supprimés`);
    console.log(`✅ ${resultatAvis.deletedCount} avis supprimés`);
  } catch (error) {
    console.error("❌ Erreur :", error);
  } finally {
    await client.close();
  }
}

supprimerDonneesDemo();