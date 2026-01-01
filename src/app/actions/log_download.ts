"use server";

import { auth } from "@/auth";
import { rtdb } from "@/lib/firebase";
import { format } from "date-fns";

export async function downloadLogsCsv() {
    const session = await auth();
    // Admin check (assuming admin role or specific email)
    const isAdmin = session?.user?.role === 'admin' || session?.user?.email === process.env.ADMIN_EMAIL;
    
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'ADMIN' && session.user.role !== 'ROOT')) {
        throw new Error("Unauthorized: Admin access required");
    }

    try {
        const logsRef = rtdb.ref('server_logs');
        // Fetch last 1000 logs
        const snapshot = await logsRef.orderByChild('createdAt').limitToLast(1000).once('value');

        if (!snapshot.exists()) {
            return "Timestamp,Level,Message,User,Context,Data\nNo logs found.";
        }

        const logs: any[] = [];
        snapshot.forEach((child) => {
            logs.push(child.val());
        });

        // Sort descending (newest first)
        logs.sort((a, b) => b.timestamp - a.timestamp);

        // CSV Header
        const header = ["Timestamp", "Level", "Message", "User", "Context", "Data"];
        const rows = logs.map(log => {
            const time = format(log.timestamp, "yyyy-MM-dd HH:mm:ss");
            const dataStr = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : "";
            
            return [
                time,
                log.level.toUpperCase(),
                `"${(log.message || "").replace(/"/g, '""')}"`,
                log.userId || "system",
                log.context || "",
                `"${dataStr}"`
            ].join(",");
        });

        return [header.join(","), ...rows].join("\n");

    } catch (e) {
        console.error("Failed to download logs:", e);
        throw new Error("Failed to generate log CSV");
    }
}
