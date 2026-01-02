"use server";

import { db } from "@/lib/firebase";

/**
 * Send push notification to specified users
 * Called from server actions when events occur
 */
export async function sendPushNotification(
    targetUserIds: string[],
    title: string,
    body: string,
    url?: string,
    tag?: string
) {
    if (!targetUserIds || targetUserIds.length === 0) return;

    const serverKey = process.env.FIREBASE_SERVER_KEY;
    if (!serverKey) {
        console.warn("FIREBASE_SERVER_KEY not set, skipping push notification");
        return;
    }

    // Get FCM tokens for target users
    const tokens: string[] = [];
    for (const uid of targetUserIds) {
        try {
            const userDoc = await db.collection("users").doc(uid).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) tokens.push(fcmToken);
        } catch (e) {
            console.error(`Failed to get token for user ${uid}:`, e);
        }
    }

    if (tokens.length === 0) return;

    // Send via FCM HTTP API
    const fcmUrl = "https://fcm.googleapis.com/fcm/send";

    for (const token of tokens) {
        try {
            await fetch(fcmUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `key=${serverKey}`
                },
                body: JSON.stringify({
                    to: token,
                    notification: {
                        title,
                        body,
                        icon: "/icons/icon-192.png"
                    },
                    data: {
                        url: url || "/dashboard",
                        tag: tag || "default"
                    }
                })
            });
        } catch (e) {
            console.error("Push send failed:", e);
        }
    }
}
