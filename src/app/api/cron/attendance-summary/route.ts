import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";
import { NextResponse } from "next/server";
import { getAttendanceSummaryData, formatAttendanceMessage } from "@/app/actions/notifications";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        console.log("Starting Attendance Summary Cron...");
        
        // 1. Get Data & Format
        const data = await getAttendanceSummaryData();
        const body = await formatAttendanceMessage(data);

        // 2. Find Target Users
        const usersSnap = await db.collection("users").get();
        const targetIds: string[] = [];

        for (const doc of usersSnap.docs) {
            const u = doc.data();
            // Check settings
            const settings = u.notificationSettings || {};
            if (settings.afternoonAttendance !== false && u.fcmToken) {
                 targetIds.push(doc.id);
            }
        }

        if (targetIds.length > 0) {
            await sendPushNotification(
                targetIds,
                "今日の出席状況 (15:45)",
                body,
                "/attendance",
                "attendance-summary",
                "afternoonAttendance"
            );
        }

        return NextResponse.json({ success: true, sentCount: targetIds.length });

    } catch (e: any) {
        console.error("Attendance Cron Failed", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
