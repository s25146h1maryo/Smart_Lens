"use server";

import { db, adminApp } from "@/lib/firebase";
import { getMessaging } from "firebase-admin/messaging";
import { NotificationSettingsSchema } from "@/lib/schemas";

type NotificationType = keyof typeof NotificationSettingsSchema.shape;

/**
 * Send push notification to specified users
 * Checks user settings before sending
 */
export async function sendPushNotification(
    targetUserIds: string[],
    title: string,
    body: string,
    url?: string,
    tag?: string,
    type: NotificationType = 'taskAssignment' // Default to general type if unspecified
) {
    if (!targetUserIds || targetUserIds.length === 0) return;

    // Use Admin SDK Messaging (Requires Service Account credentials to be set in Env)
    let messaging;
    try {
        messaging = getMessaging(adminApp);
    } catch (e) {
        console.warn("Firebase Messaging not initialized (likely missing creds)", e);
        return;
    }

    // Get Users and Filter by Settings
    const tokens: string[] = [];
    
    // Process in chunks of 10 for Firestore read efficiency? 
    // For now, simple loop is fine as targetUserIds is usually small (team size).
    for (const uid of targetUserIds) {
        try {
            const userDoc = await db.collection("users").doc(uid).get();
            if (!userDoc.exists) continue;
            
            const data = userDoc.data();
            const fcmToken = data?.fcmToken;
            
            if (!fcmToken) continue;

            // Check Settings
            // Default to TRUE if setting is missing (opt-out model)
            const settings = data?.notificationSettings || {};
            const isEnabled = settings[type] !== false; 

            if (isEnabled) {
                tokens.push(fcmToken);
            }
        } catch (e) {
            console.error(`Failed to get token for user ${uid}:`, e);
        }
    }

    if (tokens.length === 0) return;

    // Send via FCM Admin SDK (Multicast)
    try {
        const message = {
            // Data-only message to prevent automatic duplicate display by SDK
            data: {
                title,
                body,
                url: url || "/dashboard",
                tag: tag || "default"
            },
            tokens: tokens,
            webpush: {
                headers: {
                    Urgency: "high",
                }
            }
        };

        const response = await messaging.sendEachForMulticast(message);
        
        if (response.failureCount > 0) {
            console.warn(`Failed to send ${response.failureCount} notifications`);
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Error sending to token ${tokens[idx]}:`, resp.error);
                    // Optional: Remove invalid tokens if error code matches
                }
            });
        }
    } catch (e) {
        console.error("Push send failed:", e);
    }
}
