import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { auth } from "@/auth";

// Send push notification via Firebase Cloud Messaging
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { targetUserIds, title, body, url, tag } = await request.json();

        if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
            return NextResponse.json({ error: "No target users" }, { status: 400 });
        }

        // Get FCM tokens for target users
        const tokens: string[] = [];
        for (const uid of targetUserIds) {
            const userDoc = await db.collection("users").doc(uid).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) tokens.push(fcmToken);
        }

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: "No tokens found" });
        }

        // Send via FCM HTTP API
        const fcmUrl = "https://fcm.googleapis.com/fcm/send";
        const serverKey = process.env.FIREBASE_SERVER_KEY;

        if (!serverKey) {
            console.warn("FIREBASE_SERVER_KEY not set, skipping push notification");
            return NextResponse.json({ success: true, sent: 0, message: "Server key not configured" });
        }

        const results = await Promise.all(
            tokens.map(async (token) => {
                try {
                    const response = await fetch(fcmUrl, {
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
                    return response.ok;
                } catch {
                    return false;
                }
            })
        );

        const sentCount = results.filter(Boolean).length;
        return NextResponse.json({ success: true, sent: sentCount });
    } catch (error) {
        console.error("Push send error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
