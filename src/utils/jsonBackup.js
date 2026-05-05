const fs = require("fs");
const path = require("path");
const { connectToDatabase } = require("../config/db");

const BACKUP_DIR = "C:\\backup";

// Collections to export. Extend this list if needed later.
const COLLECTIONS = [
  "users",
  "memberships",
  "nonmembers",
  "admin_actions",
  "user_actions",
  "usercheckin",
  "notifications",
];

/**
 * Ensures the backup directory exists on disk.
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a JSON backup that contains every listed collection in a single file.
 */
async function createJSONBackup() {
  const db = await connectToDatabase();

  ensureDirectory(BACKUP_DIR);
  const timestamp = new Date();
  const folderName = timestamp.toISOString().replace(/[:.]/g, "-");
  const backupFolderPath = path.join(BACKUP_DIR, folderName);
  ensureDirectory(backupFolderPath);

  const files = [];

  for (const collectionName of COLLECTIONS) {
    const collectionFileName = `${collectionName}.json`;
    const collectionFilePath = path.join(backupFolderPath, collectionFileName);

    try {
      const collection = db.collection(collectionName);
      const records = await collection.find({}).toArray();
      fs.writeFileSync(
        collectionFilePath,
        JSON.stringify(records, null, 2),
        "utf8"
      );
      const stats = fs.statSync(collectionFilePath);
      files.push({
        collection: collectionName,
        fileName: collectionFileName,
        filePath: collectionFilePath,
        sizeBytes: stats.size,
      });
    } catch (error) {
      console.warn(
        `Skipping collection "${collectionName}" due to error:`,
        error.message
      );
      files.push({
        collection: collectionName,
        fileName: collectionFileName,
        filePath: collectionFilePath,
        error: true,
        message: error.message,
      });
    }
  }

  const metadata = {
    createdAt: timestamp.toISOString(),
    totalCollections: COLLECTIONS.length,
    baseDirectory: backupFolderPath,
  };
  fs.writeFileSync(
    path.join(backupFolderPath, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  return {
    success: true,
    message: "Backup completed successfully.",
    backupFolderPath,
    folderName,
    files,
    createdAt: metadata.createdAt,
  };
}

module.exports = {
  createJSONBackup,
  BACKUP_DIR,
};
