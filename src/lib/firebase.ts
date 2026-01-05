import "server-only";
import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

// Firebase Realtime Database URL from env (with fallback for backward compatibility)
const RTDB_URL = process.env.FIREBASE_DATABASE_URL || "https://smartlens-facd7-default-rtdb.asia-southeast1.firebasedatabase.app";

// Initialize Firebase Admin SDK
// Uses environment variables for configuration
const getFirebaseApp = (): App => {
    if (getApps().length > 0) {
        return getApp();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    // Robust parsing for Private Key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
        // 0. Base64 Decode optimization (Most robust method)
        // If the key doesn't start with the standard header, assume it's Base64 encoded
        if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
            try {
                privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
            } catch (e) {
                console.error("Failed to decode Base64 private key", e);
            }
        }

        // 1. Remove wrapping quotes if present
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
             privateKey = privateKey.slice(1, -1);
        }
        // 2. Convert literal "\n" strings to actual newlines
        privateKey = privateKey.replace(/\\n/g, "\n");
        // 3. Remove Windows-style carriage returns
        privateKey = privateKey.replace(/\r/g, "");
    }

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing Firebase Admin credentials in environment variables.");
    }

    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        projectId,
        databaseURL: RTDB_URL,
    });
};

export const adminApp = getFirebaseApp();
export const db = getFirestore(adminApp);
export const rtdb = getDatabase(adminApp);
