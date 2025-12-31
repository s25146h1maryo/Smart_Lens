"use server";

import { auth } from "@/auth";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { AttendanceStatus, WeeklyAttendance } from "@/types/attendance";
import { format, addDays } from "date-fns";

// Initialize Admin SDK with database URL
const RTDB_URL = "https://smartlens-facd7-default-rtdb.asia-southeast1.firebasedatabase.app";

function getAdminDatabase() {
    // Check if already initialized
    if (getApps().length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Missing Firebase Admin credentials");
        }

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
            databaseURL: RTDB_URL,
        });
    }
    
    return getDatabase();
}

/**
 * Get attendance data for a week starting from the given date
 */
export async function getWeekAttendance(startDateStr: string): Promise<WeeklyAttendance> {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const db = getAdminDatabase();
    const startDate = new Date(startDateStr);
    const endDateStr = format(addDays(startDate, 6), "yyyy-MM-dd");

    try {
        // Query attendance data for the date range
        const snapshot = await db
            .ref("attendance")
            .orderByKey()
            .startAt(startDateStr)
            .endAt(endDateStr)
            .once("value");

        return snapshot.val() || {};
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return {};
    }
}

/**
 * Update attendance status for a specific date and user
 */
export async function updateAttendanceStatus(
    dateStr: string,
    status: AttendanceStatus
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const db = getAdminDatabase();
    const userId = session.user.id;
    const userName = session.user.name || "User";

    try {
        await db.ref(`attendance/${dateStr}/${userId}`).set({
            status,
            userName,
            updatedAt: Date.now(),
        });

        return { success: true };
    } catch (error) {
        console.error("Error updating attendance:", error);
        return { success: false, error: "Failed to update" };
    }
}

/**
 * Cleanup old attendance data (before today)
 */
export async function cleanupOldAttendance(): Promise<void> {
    const session = await auth();
    if (!session?.user) return;

    const db = getAdminDatabase();
    const yesterdayStr = format(addDays(new Date(), -1), "yyyy-MM-dd");

    try {
        const snapshot = await db
            .ref("attendance")
            .orderByKey()
            .endAt(yesterdayStr)
            .once("value");

        if (snapshot.exists()) {
            const updates: Record<string, null> = {};
            snapshot.forEach((child) => {
                if (child.key) {
                    updates[child.key] = null;
                }
            });

            if (Object.keys(updates).length > 0) {
                await db.ref("attendance").update(updates);
            }
        }
    } catch (error) {
        console.error("Error cleaning up attendance:", error);
    }
}
