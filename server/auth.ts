import { Express } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  DATABASE_URL,
  SESSION_SECRET,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} from "./env";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// ------------------- Initialize Firebase Admin -------------------
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const firebaseAuth = getAuth();

// ------------------- Setup Auth -------------------
export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: SESSION_SECRET || "luggage-link-secret-key",
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        httpOnly: true,
        secure: false, // set true in production with HTTPS
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ------------------- LocalStrategy (Email/Password) -------------------
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const userRecord = await firebaseAuth.getUserByEmail(email);
          let user = await storage.getUserByEmail(email);

          // Auto-create user if doesn't exist in Postgres
          if (!user) {
            user = await storage.createUser({
              firebaseUid: userRecord.uid,
              email: userRecord.email!,
              firstName: userRecord.displayName?.split(" ")[0] || "Unknown",
              lastName: userRecord.displayName?.split(" ")[1] || "",
              password: "firebase-auth", // placeholder
              isVerified: userRecord.emailVerified,
              verificationStatus: {
                idVerified: false,
                phoneVerified: false,
                addressVerified: false,
              },
            });
          }

          if (!userRecord.emailVerified) {
            return done(null, false, {
              message: "Please verify your email before logging in.",
            });
          }

          return done(null, user);
        } catch (err) {
          console.error("LocalStrategy error:", err);
          return done(null, false, { message: "Invalid credentials" });
        }
      }
    )
  );

  // ------------------- Serialize & Deserialize -------------------
  passport.serializeUser((user, done) => done(null, (user as any).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (err) {
      done(err, false);
    }
  });

  // ------------------- Firebase Middleware -------------------
  async function firebaseAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      const decoded = await firebaseAuth.verifyIdToken(token);
      let user = await storage.getUserByFirebaseUid(decoded.uid);

      if (!user) {
        const [firstName, lastName = ""] = (decoded.name || "").split(" ");
        user = await storage.createUser({
          firebaseUid: decoded.uid,
          email: decoded.email!,
          firstName,
          lastName,
          password: "firebase-auth",
          isVerified: decoded.email_verified || false,
          verificationStatus: {
            idVerified: false,
            phoneVerified: false,
            addressVerified: false,
          },
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Firebase auth middleware error:", error);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  }

  // ------------------- Routes -------------------

  // ✅ Register new user
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      const userRecord = await firebaseAuth.createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
      });

      const verificationLink = await firebaseAuth.generateEmailVerificationLink(email);
      console.log("Send verification link:", verificationLink);

      const user = await storage.createUser({
        firebaseUid: userRecord.uid,
        email,
        firstName,
        lastName,
        password: "firebase-auth",
        isVerified: false,
        verificationStatus: {
          idVerified: false,
          phoneVerified: false,
          addressVerified: false,
        },
      });

      res.status(201).json({
        message: "Registered. Please check your email to verify your account.",
        user: { ...user, password: undefined },
      });
    } catch (err) {
      console.error("Register error:", err);
      next(err);
    }
  });

  // ✅ Email/Password Login
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user)
        return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // ✅ Google Login
  app.post("/api/login/google", async (req, res) => {
    const { idToken } = req.body;
    console.log("Received Google token:", idToken?.slice(0, 20));

    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      console.log("Decoded Token:", decoded);

      const email = decoded.email;
      const firebaseUid = decoded.uid;
      const name = decoded.name || "";

      if (!email) throw new Error("Google token missing email");

      let user = await storage.getUserByEmail(email);
      if (!user) {
        const [firstName, lastName = ""] = name.split(" ");
        user = await storage.createUser({
          firebaseUid,
          email,
          firstName,
          lastName,
          password: "firebase-auth",
          isVerified: true,
          verificationStatus: {
            idVerified: false,
            phoneVerified: false,
            addressVerified: false,
          },
        });
      }

      req.login(user, (err) => {
        if (err) throw err;
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (err) {
      console.error("Firebase verifyIdToken failed:", err);
      res.status(401).json({ message: "Invalid Google token" });
    }
  });

  // ✅ Logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // ✅ Current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });

  // ✅ Protect all sensitive routes
  app.use("/api/trips", firebaseAuthMiddleware);
  app.use("/api/packages", firebaseAuthMiddleware);
  app.use("/api/messages", firebaseAuthMiddleware);
}
