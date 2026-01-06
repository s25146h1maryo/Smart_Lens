"use server";

import { auth } from "@/auth";
import { db, adminApp } from "@/lib/firebase";
import { getDatabase } from "firebase-admin/database";
import { sendPushNotification } from "@/lib/push";
import { format } from "date-fns";
import { Task } from "@/types";

// Helper to check ROOT permission
async function checkRoot() {
    const session = await auth();
    if (session?.user?.role !== "ROOT") {
        throw new Error("Unauthorized: ROOT access required");
    }
    return session.user;
}

// --- Attendance Summary Logic ---

async function getAttendanceSummaryData() {
    const rtdb = getDatabase(adminApp);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const snapshot = await rtdb.ref(`attendance/${todayStr}`).once("value");
    const data = snapshot.val() || {};
    
    // Categorize
    const until1900: string[] = [];
    const until1645: string[] = [];
    const noST: string[] = [];
    const home: string[] = [];

    Object.values(data).forEach((record: any) => {
        const name = record.userName || "Unknown";
        if (record.status === '19:00') until1900.push(name);
        else if (record.status === '16:45') until1645.push(name);
        else if (record.status === 'NoST') noST.push(name);
        else if (record.status === 'Home') home.push(name);
    });

    return { until1900, until1645, noST, home };
}

async function formatAttendanceMessage(data: { until1900: string[], until1645: string[], noST: string[], home: string[] }) {
    let body = "";
    
    if (data.until1900.length > 0) {
        body += `🌙 19:00まで (${data.until1900.length}人): ${data.until1900.join(", ")}\n\n`;
    }
    if (data.until1645.length > 0) {
        body += `🌇 16:45まで (${data.until1645.length}人): ${data.until1645.join(", ")}\n\n`;
    }
    if (data.noST.length > 0) {
        body += `🏫 校内不参加 (${data.noST.length}人): ${data.noST.join(", ")}\n\n`;
    }
    if (data.home.length > 0) {
        body += `🏠 帰宅 (${data.home.length}人): ${data.home.join(", ")}`;
    }

    if (!body) body = "本日の出席登録はありません。";
    
    return body.trim();
}

export async function testAttendanceSummary(target: 'me' | 'all') {
    const user = await checkRoot();
    const data = await getAttendanceSummaryData();
    const body = await formatAttendanceMessage(data);
    
    let targetIds: string[] = [];

    if (target === 'me') {
        targetIds = [user.id];
    } else {
        // Fetch all subscribed users
        const usersSnap = await db.collection("users").get();
        for (const doc of usersSnap.docs) {
            const u = doc.data();
            const settings = u.notificationSettings || {};
            // Default to true if undefined, but check explicit false
            if (settings.afternoonAttendance !== false && u.fcmToken) {
                 targetIds.push(doc.id);
            }
        }
    }

    if (targetIds.length > 0) {
        await sendPushNotification(
            targetIds,
            `今日の出席状況 (テスト: ${target === 'me' ? '自分' : '全員'})`,
            body,
            "/attendance",
            "attendance-summary",
            "afternoonAttendance"
        );
    }

    return { success: true, count: targetIds.length, body };
}


// --- Morning Summary Logic ---

async function getMorningSummaryForUser(userId: string): Promise<{ body: string, hasContent: boolean }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch tasks
    const tasksSnap = await db.collection("tasks")
        .where("assigneeIds", "array-contains", userId)
        .where("status", "!=", "done")
        .get();

    const tasks = tasksSnap.docs.map(t => ({ id: t.id, ...t.data() } as Task));
    
    const dueToday = tasks.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= startOfDay && d <= endOfDay;
    });

    const overdue = tasks.filter(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < startOfDay;
    });

    if (dueToday.length === 0 && overdue.length === 0) {
        return { body: "", hasContent: false };
    }

    const dueCount = dueToday.length;
    const overdueCount = overdue.length;
    
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

    return { body, hasContent: true };
}

export async function testMorningSummary(target: 'me' | 'all') {
    const user = await checkRoot();
    
    let targetUsers: { id: string }[] = [];

    if (target === 'me') {
        targetUsers = [{ id: user.id }];
    } else {
        const usersSnap = await db.collection("users").get();
        for (const doc of usersSnap.docs) {
            const u = doc.data();
            const settings = u.notificationSettings || {};
            if (settings.morningSummary !== false && u.fcmToken) {
                targetUsers.push({ id: doc.id });
            }
        }
    }

    let sentCount = 0;
    let lastBody = "";

    for (const u of targetUsers) {
        const { body, hasContent } = await getMorningSummaryForUser(u.id);
        if (hasContent) {
            await sendPushNotification(
                [u.id],
                `今日のタスク状況 (テスト: ${target === 'me' ? '自分' : '全員'})`,
                body,
                "/todo",
                "morning-summary",
                "morningSummary"
            );
            sentCount++;
            lastBody = body;
        }
    }

    return { success: true, count: sentCount, body: lastBody };
}

// Export for Cron Jobs usage
export { getAttendanceSummaryData, formatAttendanceMessage, getMorningSummaryForUser };
