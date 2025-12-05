import "dotenv/config";

export const DATABASE_URL =
  process.env.POSTGRES_URL || "postgresql://postgres:zelalem@localhost:5432/luggagelink";

export const PERSONA_API_KEY =
  process.env.PERSONA_API_KEY || "your_persona_api_key_here";

export const PERSONA_TEMPLATE_ID =
  process.env.PERSONA_TEMPLATE_ID || "your_template_id_here";

export const SESSION_SECRET =
  process.env.SESSION_SECRET || "luggage-link-secret-key";

// Firebase
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};



export const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

// App URLs
export const APP_URL = process.env.APP_URL || "http://localhost:5000";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";



