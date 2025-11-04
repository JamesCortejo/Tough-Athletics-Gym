const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const { connectToDatabase } = require("./db");

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
    }
  )
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
    }
  )
);

// Common function to handle OAuth users
async function handleOAuthUser(profile, authMethod, done) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Determine the ID field based on auth method
    const idField = authMethod === "google" ? "googleId" : "facebookId";

    // Check if user already exists by provider ID
    let user = await usersCollection.findOne({ [idField]: profile.id });

    if (user) {
      console.log(
        `Existing ${authMethod} user found:`,
        user.email || user.username
      );
      return done(null, user);
    }

    // Extract user data based on provider
    let email, firstName, lastName, profilePicture, username;

    if (authMethod === "google") {
      email = profile.emails[0].value;
      firstName = profile.name.givenName;
      lastName = profile.name.familyName;
      profilePicture = profile.photos[0].value;
      username = email.split("@")[0];
    } else if (authMethod === "facebook") {
      email =
        profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      firstName = profile.name.givenName;
      lastName = profile.name.familyName;
      profilePicture =
        profile.photos && profile.photos[0] ? profile.photos[0].value : null;
      username = email ? email.split("@")[0] : `user_${profile.id}`;
    }

    // Check if user exists by email (to link accounts)
    if (email) {
      user = await usersCollection.findOne({ email: email });

      if (user) {
        // Update existing user with provider ID
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              [idField]: profile.id,
              profilePicture: profilePicture,
              authMethod: authMethod,
              updatedAt: new Date(),
            },
          }
        );
        console.log(`Linked existing user with ${authMethod}:`, user.email);
        return done(null, user);
      }
    }

    // Create new user from OAuth profile
    const newUser = {
      [idField]: profile.id,
      firstName: firstName,
      lastName: lastName,
      username: username,
      email: email,
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
    const qrCodePath = await generateQRCode(userId, newUser.username, qrCodeId);
    await usersCollection.updateOne(
      { _id: result.insertedId },
      { $set: { qrCode: qrCodePath } }
    );

    // Get the complete user document
    user = await usersCollection.findOne({ _id: result.insertedId });
    console.log(
      `New ${authMethod} user created (needs profile completion):`,
      user.email || user.username
    );

    return done(null, user);
  } catch (error) {
    console.error(`${authMethod} OAuth error:`, error);
    return done(error, null);
  }
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
    const user = await usersCollection.findOne({
      _id: new require("mongodb").ObjectId(id),
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
