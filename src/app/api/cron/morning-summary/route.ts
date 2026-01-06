import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";
import { Task } from "@/types";
import { NextResponse } from "next/server";

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
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        let sentCount = 0;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;

            // Check if user has enabled morning summary
            const settings = userData.notificationSettings || {};
            if (settings.morningSummary === false) continue; // Skip if disabled
            if (!userData.fcmToken) continue;

            // Fetch tasks for this user
            // 1. Assigned tasks that are NOT done
            const tasksSnap = await db.collection("tasks")
                .where("assigneeIds", "array-contains", userId)
                .where("status", "!=", "done") // Requires composite index? If so, might fail. 
                // Firestore inequality filter limitation: Field in inequality must be the first in orderBy.
                // Let's do simple query and filter in memory to be safe and avoid index creation requirement during runtime.
                .get();

            const tasks = tasksSnap.docs.map(t => ({ id: t.id, ...t.data() } as Task));
            
            // Filter: Due Today OR Overdue OR High Priority
            const dueToday = tasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d >= startOfDay && d <= endOfDay;
            });

            const overdue = tasks.filter(t => {
                 if (!t.dueDate) return false;
                 return new Date(t.dueDate) < startOfDay;
            });

            // If no relevant tasks, maybe don't send? or send "No tasks today"?
            // Usually "No tasks" is good info, but might be annoying.
            // Requirement: "Summarize by priority"
            // Let's only send if there are tasks.

            if (dueToday.length === 0 && overdue.length === 0) continue;

            const dueCount = dueToday.length;
            const overdueCount = overdue.length;
            
            // Construct Message
            let body = "";
            if (overdueCount > 0) body += `⚠ 期限切れ: ${overdueCount}件\n`;
            if (dueCount > 0) body += `📅 今日が期限: ${dueCount}件\n`;
            
            // Add top priority task title
            const priorityTask = [...dueToday, ...overdue].sort((a, b) => {
                const pMap = { high: 3, medium: 2, low: 1 };
                return (pMap[b.priority || 'medium'] || 0) - (pMap[a.priority || 'medium'] || 0);
            })[0];

            if (priorityTask) {
                body += `最優先: ${priorityTask.title}`;
            }

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

        return NextResponse.json({ success: true, sentCount });
    } catch (e: any) {
        console.error("Morning Cron Failed", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
