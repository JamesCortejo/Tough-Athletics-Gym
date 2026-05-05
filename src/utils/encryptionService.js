const crypto = require("crypto");
require("dotenv").config();

class EncryptionService {
  constructor() {
    // Use environment variable for encryption key
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    if (!this.encryptionKey) {
      throw new Error("ENCRYPTION_KEY is not set in environment variables");
    }
    this.algorithm = "aes-256-cbc";
    this.ivLength = 16;
  }

  // Generate encryption key from environment variable
  getKey() {
    // Ensure key is exactly 32 bytes (256 bits) for AES-256
    const key = crypto.createHash("sha256").update(this.encryptionKey).digest();
    return key;
  }

  // Encrypt text with random IV (for storage)
  encrypt(text) {
    try {
      if (!text) return text;

      const iv = crypto.randomBytes(this.ivLength);
      const key = this.getKey();
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return iv + encrypted text for decryption
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Encryption failed");
    }
  }

  // Decrypt text
  decrypt(encryptedText) {
    try {
      if (!encryptedText || typeof encryptedText !== "string")
        return encryptedText;

      // Check if text is encrypted (contains colon separator)
      if (!encryptedText.includes(":")) {
        return encryptedText; // Return as-is if not encrypted
      }

      if (!this.isEncrypted(encryptedText)) {
        return encryptedText;
      }

      const textParts = encryptedText.split(":");
      const iv = Buffer.from(textParts.shift(), "hex");
      const encrypted = textParts.join(":");
      const key = this.getKey();

      if (iv.length !== this.ivLength || encrypted.length % 2 !== 0) {
        return encryptedText;
      }

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.warn("Decryption fallback used:", error.message);
      return encryptedText;
    }
  }

  // Create a hash for lookup (deterministic)
  createLookupHash(text) {
    try {
      if (!text) return null;

      // Use SHA-256 hash for deterministic lookup
      // Normalize by trimming and converting to lowercase
      const normalizedText = text.toString().trim().toLowerCase();
      return crypto.createHash("sha256").update(normalizedText).digest("hex");
    } catch (error) {
      console.error("Hash creation error:", error);
      throw new Error("Hash creation failed");
    }
  }

  // Helper to check if text is encrypted
  isEncrypted(text) {
    if (typeof text !== "string") return false;

    const separatorIndex = text.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === text.length - 1) {
      return false;
    }

    const ivHex = text.slice(0, separatorIndex);
    const encryptedHex = text.slice(separatorIndex + 1);

    const expectedIvHexLength = this.ivLength * 2;
    const hexRegex = /^[0-9a-f]+$/i;

    return (
      ivHex.length === expectedIvHexLength &&
      encryptedHex.length > 0 &&
      encryptedHex.length % 2 === 0 &&
      hexRegex.test(ivHex) &&
      hexRegex.test(encryptedHex)
    );
  }

  // Helper to encrypt object fields
  encryptObject(obj, fieldsToEncrypt) {
    if (!obj) return obj;

    const result = { ...obj };
    fieldsToEncrypt.forEach((field) => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.encrypt(String(result[field]));
      }
    });
    return result;
  }

  // Helper to decrypt object fields
  decryptObject(obj, fieldsToDecrypt) {
    if (!obj) return obj;

    const result = { ...obj };
    fieldsToDecrypt.forEach((field) => {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          result[field] = this.decrypt(String(result[field]));
        } catch (error) {
          result[field] = result[field];
        }
      }
    });
    return result;
  }
}

module.exports = new EncryptionService();
