const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const { connectToDatabase } = require("./db");
const encryptionService = require("../utils/encryptionService");

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google OAuth profile:", profile);
        await handleOAuthUser(profile, "google", done);
      } catch (error) {
        console.error("Google OAuth error:", error);
        return done(error, null);
      }
    },
  ),
);

// Configure Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${
        process.env.BASE_URL || "http://localhost:3000"
      }/auth/facebook/callback`,
      profileFields: ["id", "emails", "name", "displayName", "photos"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Facebook OAuth profile:", profile);
        await handleOAuthUser(profile, "facebook", done);
      } catch (error) {
        console.error("Facebook OAuth error:", error);
        return done(error, null);
      }
    },
  ),
);

// Common function to handle OAuth users
async function handleOAuthUser(profile, authMethod, done) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Determine the ID field based on auth method
    const idField = authMethod === "google" ? "googleId" : "facebookId";

    // First: Try to find by unencrypted Google/Facebook ID
    // Since the encryption is non-deterministic (random IV), we need to search differently
    let user = null;

    // Try to find by any encrypted Google ID that might decrypt to this profile.id
    const allUsers = await usersCollection
      .find({ authMethod: authMethod })
      .toArray();

    for (const existingUser of allUsers) {
      try {
        // Decrypt the stored provider ID
        const decryptedProviderId = encryptionService.decrypt(
          existingUser[idField],
        );

        // If decryption succeeds and matches the current profile ID, we found the user
        if (decryptedProviderId === profile.id) {
          user = existingUser;
          console.log(
            `Found existing ${authMethod} user by ID comparison:`,
            user.email || user.username,
          );
          break;
        }
      } catch (error) {
        // If decryption fails, continue checking other users
        continue;
      }
    }

    // If we found a user by ID comparison, return it
    if (user) {
      return done(null, user);
    }

    // If not found by ID, try to find by email
    let email = null;
    if (authMethod === "google") {
      email = profile.emails[0].value;
    } else if (authMethod === "facebook") {
      email =
        profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    }

    if (email) {
      // Search for user by comparing decrypted emails
      for (const existingUser of allUsers) {
        try {
          const decryptedEmail = encryptionService.decrypt(existingUser.email);

          if (decryptedEmail === email) {
            user = existingUser;
            console.log(
              `Found existing user by email (${email}), will link ${authMethod} account`,
            );

            // Link the provider ID to existing account
            const encryptedProviderId = encryptionService.encrypt(profile.id);
            await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  [idField]: encryptedProviderId,
                  authMethod: authMethod,
                  profilePicture: profile.photos[0].value,
                  updatedAt: new Date(),
                },
              },
            );

            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // If user still not found, create a new one
    if (!user) {
      console.log(`Creating new ${authMethod} user`);

      // Extract user data based on provider
      let firstName, lastName, profilePicture, username;

      if (authMethod === "google") {
        email = profile.emails[0].value;
        firstName = profile.name.givenName || "";
        lastName = profile.name.familyName || "";
        profilePicture = profile.photos[0].value;
        username = generateUniqueUsername(email.split("@")[0]);
      } else if (authMethod === "facebook") {
        email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        firstName = profile.name.givenName || "";
        lastName = profile.name.familyName || "";
        profilePicture =
          profile.photos && profile.photos[0] ? profile.photos[0].value : null;
        username = email
          ? generateUniqueUsername(email.split("@")[0])
          : `user_${profile.id.substring(0, 8)}`;
      }

      // Create new user
      const newUser = {
        [idField]: encryptionService.encrypt(profile.id),
        firstName: firstName,
        lastName: lastName,
        username: username,
        email: encryptionService.encrypt(email),
        profilePicture: profilePicture,
        authMethod: authMethod,
        emailVerified: !!email,
        needsProfileCompletion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate QR code for new user
      const {
        generateQRCode,
        generateQRCodeId,
      } = require("../utils/qrGenerator");
      const qrCodeId = generateQRCodeId();
      newUser.qrCodeId = qrCodeId;

      const result = await usersCollection.insertOne(newUser);
      const userId = result.insertedId.toString();

      // Generate QR code
      const qrCodePath = await generateQRCode(
        userId,
        newUser.username,
        qrCodeId,
      );
      await usersCollection.updateOne(
        { _id: result.insertedId },
        { $set: { qrCode: qrCodePath } },
      );

      // Get the complete user document
      user = await usersCollection.findOne({ _id: result.insertedId });
      console.log(`New ${authMethod} user created:`, user.username);
    }

    return done(null, user);
  } catch (error) {
    console.error(`${authMethod} OAuth error:`, error);
    return done(error, null);
  }
}

// Helper function to generate unique username (without uuid)
function generateUniqueUsername(baseUsername) {
  // Remove special characters and convert to lowercase
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  // Add random 4-digit number and timestamp to ensure uniqueness
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-4);
  return `${cleanBase}${randomSuffix}${timestamp}`;
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    let user = await usersCollection.findOne({
      _id: new require("mongodb").ObjectId(id),
    });

    // Decrypt sensitive data before passing to session
    if (user) {
      user = encryptionService.decryptObject(user, [
        "email",
        "mobile",
        "googleId",
        "facebookId",
      ]);
    }

    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
