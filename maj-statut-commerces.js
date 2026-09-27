// maj-statut-commerces.js — ajoute le champ "ouvert" à tous les commerces existants

const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb+srv://amanijessica961_db_user:OLiR8BKgmAx0Iyqo@cluster0.bdt6cdn.mongodb.net/?appName=Cluster0";

async function majStatuts() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db("kolis");

    const resultat = await db.collection("commerces").updateMany(
      { ouvert: { $exists: false } },
      { $set: { ouvert: true } }
    );

    console.log(`✅ ${resultat.modifiedCount} commerces mis à jour avec le statut "ouvert"`);
  } catch (error) {
    console.error("❌ Erreur :", error);
  } finally {
    await client.close();
  }
}

majStatuts();