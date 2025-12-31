"use server";

import { auth as getSession } from "@/auth";
import { adminApp } from "@/lib/firebase";
import { getAuth } from "firebase-admin/auth";

export async function getFirebaseToken() {
    const session = await getSession();
    
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const uid = session.user.id;
    const adminAuth = getAuth(adminApp);
    
    try {
        const customToken = await adminAuth.createCustomToken(uid);
        return customToken;
    } catch (error) {
        console.error("Error creating custom token:", error);
        throw new Error("Failed to create token");
    }
}
