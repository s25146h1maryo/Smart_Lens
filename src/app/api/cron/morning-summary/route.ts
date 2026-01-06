import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";
import { NextResponse } from "next/server";
import { getMorningSummaryForUser } from "@/app/actions/notifications";

export const dynamic = 'force-dynamic'; // Ensure not cached

export async function GET(request: Request) {
    // Verify Cron Secret (Optional but recommended for Vercel Cron)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow local dev or strict cron
        // return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("Starting Morning Summary Cron...");

        const usersSnap = await db.collection("users").get();
        let sentCount = 0;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;

            // Check if user has enabled morning summary
            const settings = userData.notificationSettings || {};
            if (settings.morningSummary === false) continue; // Skip if disabled
            if (!userData.fcmToken) continue;

            // Get summary content
            const { body, hasContent } = await getMorningSummaryForUser(userId);

            if (hasContent) {
                await sendPushNotification(
                    [userId],
                    "今日のタスク状況 (7:30)",
                    body,
                    "/todo", // Link to Todo page
                    "morning-summary",
                    "morningSummary"
                );
                sentCount++;
            }
        }

        return NextResponse.json({ success: true, sentCount });
    } catch (e: any) {
        console.error("Morning Cron Failed", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
