"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { Task, Thread } from "@/types";
import crypto from "crypto";

export async function getCalendarTasks() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const userId = session.user.id;

    // 1. Get Threads user is a member of
    // Can we use 'threads' collection where 'members' array-contains userId?
    const threadsSnap = await db.collection("threads")
        .where("members", "array-contains", userId)
        .where("status", "in", ["active", "pending"]) // Exclude archived? Or include? Let's include active/pending.
        .get();

    if (threadsSnap.empty) return [];

    const tasks: (Task & { threadTitle: string })[] = [];

    // 2. Fetch Tasks for each thread
    // Optimized: Promise.all
    await Promise.all(threadsSnap.docs.map(async (threadDoc) => {
        const threadData = threadDoc.data() as Thread;
        const threadTitle = threadData.title;

        // FIXED: Tasks are at root level, linked by threadId
        const tasksSnap = await db.collection("tasks")
            .where("threadId", "==", threadDoc.id)
            .get();
        
        tasksSnap.docs.forEach(doc => {
            const data = doc.data();
            // Basic validation
            if (data.title) {
                tasks.push({
                    id: doc.id,
                    ...data,
                    threadTitle
                } as Task & { threadTitle: string });
            }
        });
    }));

    return tasks;
}

/**
 * Generate or retrieve the user's iCal subscription token.
 * This token is stored in the user document and used to authenticate
 * external calendar apps accessing the iCal feed.
 */
export async function getOrCreateCalendarToken(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    
    // If token already exists, return it
    if (userData?.calendarToken) {
        return userData.calendarToken;
    }

    // Generate new token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString("hex");

    // Store token in user document
    await userRef.update({
        calendarToken: token,
        calendarTokenCreatedAt: Date.now()
    });

    return token;
}

/**
 * Regenerate the user's iCal subscription token (invalidates old URLs)
 */
export async function regenerateCalendarToken(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const userRef = db.collection("users").doc(userId);

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");

    // Update token in user document
    await userRef.update({
        calendarToken: token,
        calendarTokenCreatedAt: Date.now()
    });

    return token;
}

/**
 * Get the full iCal subscription URL for the current user
 */
export async function getCalendarSubscriptionUrl(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const token = await getOrCreateCalendarToken();
    if (!token) return null;

    const userId = session.user.id;
    
    // Use environment variable for base URL, fallback to production URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smart-lens.vercel.app";
    
    return `${baseUrl}/api/calendar/${userId}?token=${token}`;
}

/**
 * Validate a calendar token for a given user (used by API route)
 * This is NOT a server action - it's a utility function
 */
export async function validateCalendarToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) return false;

    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    
    // Constant-time comparison to prevent timing attacks
    if (!userData?.calendarToken) return false;
    
    try {
        return crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(userData.calendarToken)
        );
    } catch {
        return false;
    }
}

