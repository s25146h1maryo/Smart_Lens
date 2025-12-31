"use server";

import { auth } from "@/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// Initialize Admin SDK with database URL from env (with fallback for backward compatibility)
const RTDB_URL = process.env.FIREBASE_DATABASE_URL || "https://smartlens-facd7-default-rtdb.asia-southeast1.firebasedatabase.app";

function getAdminDatabase() {
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

// Types
export interface RoomStatusRecord {
    isOpen: boolean;
    updatedAt: number;
    updatedBy: string;
    updatedByName: string;
}

export interface RoomStatusData {
    current: RoomStatusRecord | null;
    history: RoomStatusRecord[];
    stats: {
        openCount: number;
        totalDays: number;
    };
}

/**
 * Get current room status, history (last 10), and monthly stats
 */
export async function getRoomStatus(): Promise<RoomStatusData> {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const db = getAdminDatabase();

    try {
        // Get current status
        const currentSnapshot = await db.ref("roomStatus/current").once("value");
        const current = currentSnapshot.val() as RoomStatusRecord | null;

        // Get history (last 10 entries)
        const historySnapshot = await db
            .ref("roomStatus/history")
            .orderByChild("updatedAt")
            .limitToLast(10)
            .once("value");
        
        const historyData = historySnapshot.val() || {};
        const history: RoomStatusRecord[] = (Object.values(historyData) as RoomStatusRecord[])
            .sort((a, b) => b.updatedAt - a.updatedAt);

        // Get monthly stats (stored as aggregated data to save space)
        const statsSnapshot = await db.ref("roomStatus/monthlyStats").once("value");
        const stats = statsSnapshot.val() || { openCount: 0, totalDays: 0 };

        return { current, history, stats };
    } catch (error) {
        console.error("Error fetching room status:", error);
        return { 
            current: null, 
            history: [], 
            stats: { openCount: 0, totalDays: 0 } 
        };
    }
}

/**
 * Update room status (toggle open/closed)
 */
export async function updateRoomStatus(
    isOpen: boolean
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const db = getAdminDatabase();
    const userId = session.user.id;
    const userName = session.user.name || "Unknown";
    const now = Date.now();

    try {
        const newRecord: RoomStatusRecord = {
            isOpen,
            updatedAt: now,
            updatedBy: userId,
            updatedByName: userName,
        };

        // Update current status
        await db.ref("roomStatus/current").set(newRecord);

        // Add to history (using push for unique keys)
        await db.ref("roomStatus/history").push(newRecord);

        // Update monthly stats if opening (only count "opens" for efficiency)
        if (isOpen) {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const todayRef = db.ref(`roomStatus/dailyOpens/${today}`);
            const existingToday = await todayRef.once("value");
            
            if (!existingToday.val()) {
                // First open of the day - increment counter
                await todayRef.set(true);
                await db.ref("roomStatus/monthlyStats/openCount").transaction((current: number | null) => {
                    return (current || 0) + 1;
                });
            }
        }

        // Cleanup old history entries (keep only last 20 to save space)
        const allHistorySnapshot = await db
            .ref("roomStatus/history")
            .orderByChild("updatedAt")
            .once("value");
        
        const allHistory = allHistorySnapshot.val() || {};
        const keys = Object.keys(allHistory);
        
        if (keys.length > 20) {
            // Sort by updatedAt and delete oldest entries
            const sorted = keys
                .map(k => ({ key: k, updatedAt: allHistory[k].updatedAt }))
                .sort((a, b) => b.updatedAt - a.updatedAt);
            
            const toDelete = sorted.slice(20);
            const updates: Record<string, null> = {};
            toDelete.forEach(item => {
                updates[item.key] = null;
            });
            
            if (Object.keys(updates).length > 0) {
                await db.ref("roomStatus/history").update(updates);
            }
        }

        // Cleanup old daily opens (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        const dailyOpensSnapshot = await db
            .ref("roomStatus/dailyOpens")
            .orderByKey()
            .endAt(cutoffDate)
            .once("value");
        
        const oldDays = dailyOpensSnapshot.val() || {};
        const oldDayKeys = Object.keys(oldDays);
        
        if (oldDayKeys.length > 0) {
            const deleteUpdates: Record<string, null> = {};
            oldDayKeys.forEach(key => {
                deleteUpdates[key] = null;
            });
            await db.ref("roomStatus/dailyOpens").update(deleteUpdates);
            
            // Decrement stats counter
            await db.ref("roomStatus/monthlyStats/openCount").transaction((current: number | null) => {
                return Math.max(0, (current || 0) - oldDayKeys.length);
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating room status:", error);
        return { success: false, error: "Failed to update" };
    }
}

/**
 * Get monthly statistics (recalculate from dailyOpens)
 */
export async function recalculateMonthlyStats(): Promise<{ openCount: number; totalDays: number }> {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const db = getAdminDatabase();
    
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        const dailyOpensSnapshot = await db
            .ref("roomStatus/dailyOpens")
            .orderByKey()
            .startAt(cutoffDate)
            .once("value");
        
        const dailyOpens = dailyOpensSnapshot.val() || {};
        const openCount = Object.keys(dailyOpens).length;
        
        // Update stored stats
        await db.ref("roomStatus/monthlyStats").set({
            openCount,
            totalDays: 30,
            lastCalculated: Date.now()
        });
        
        return { openCount, totalDays: 30 };
    } catch (error) {
        console.error("Error recalculating stats:", error);
        return { openCount: 0, totalDays: 30 };
    }
}
