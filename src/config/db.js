const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";
const dbName = "gymDatabase";
let db = null;
let client = null;

async function connectToDatabase() {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(url);
    await client.connect();
    console.log("Connected successfully to MongoDB");
    db = client.db(dbName);

    // Test the connection by listing collections
    const collections = await db.listCollections().toArray();
    console.log(
      "Available collections:",
      collections.map((c) => c.name)
    );

    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

// Close connection when app exits
process.on("SIGINT", async () => {
  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  }
});

module.exports = { connectToDatabase };
