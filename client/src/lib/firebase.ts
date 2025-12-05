// firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAxDLHKViKF5lMJ9FcyBs-LTh2bDpQ5YJc",
  authDomain: "luggagelink-d9660.firebaseapp.com",
  projectId: "luggagelink-d9660",
  storageBucket: "luggagelink-d9660.firebasestorage.app",
  messagingSenderId: "1005271012793",
  appId: "1:1005271012793:web:abe9caf57b959a1bba1268",
  measurementId: "G-PD7E6TLCKK",
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();


export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
