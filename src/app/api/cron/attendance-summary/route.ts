import { db, adminApp } from "@/lib/firebase";
import { getDatabase } from "firebase-admin/database";
import { sendPushNotification } from "@/lib/push";
import { NextResponse } from "next/server";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        console.log("Starting Attendance Summary Cron...");
        
        // 1. Fetch Today's Attendance from RTDB
        const rtdb = getDatabase(adminApp);
        const todayStr = format(new Date(), "yyyy-MM-dd");
        
        const snapshot = await rtdb.ref(`attendance/${todayStr}`).once("value");
        const data = snapshot.val() || {};
        
        // 2. Synthesize Stats
        const records = Object.values(data) as any[];
        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const late = records.filter(r => r.status === 'late').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const leave = records.filter(r => r.status === 'leave').length;

        // If no data, maybe skip? or send "No records"?
        if (total === 0) {
            return NextResponse.json({ success: true, message: "No attendance data" });
        }

        const body = `出席: ${present}人\n遅刻: ${late}人\n欠席: ${absent}人\n休暇: ${leave}人`;

        // 3. Find Target Users
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
