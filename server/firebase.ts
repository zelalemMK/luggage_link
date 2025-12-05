// server/firebase.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { firebaseConfig } from "./env";
import { getAnalytics } from "firebase/analytics";


if (!getApps().length) {
  throw new Error("Firebase app not initialized. Please initialize in server/index.ts");
}

const app = initializeApp(firebaseConfig); 

export const adminAuth = getAuth();

const analytics = getAnalytics();