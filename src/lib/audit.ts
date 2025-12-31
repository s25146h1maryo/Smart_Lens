import "server-only";
import { db } from "@/lib/firebase";
import { auth } from "@/auth";

export type AuditAction = 
    | "THREAD_CREATE"      // スレッド作成
    | "GROUP_CREATE"       // グループ作成
    | "TASK_CREATE"        // タスク作成
    | "SYSTEM_RESET"       // システムリセット
    | "TAMPER_DETECTED"    // セキュリティ違反検出
    | "USER_ROLE_CHANGE";  // ユーザー権限変更

interface AuditLogEntry {
    userId: string;
    userName?: string;
    action: AuditAction;
    targetId: string; // File or Folder ID
    targetName: string;
    timestamp: number;
    metadata?: Record<string, any>; // Flexible metadata (hash, paths, etc)
    ip?: string;
    userAgent?: string;
}

export async function logAuditAction(
    action: AuditAction, 
    targetId: string, 
    targetName: string, 
    metadata: Record<string, any> = {}
) {
    try {
        const session = await auth();
        const userId = session?.user?.id || "SYSTEM";
        const userName = session?.user?.name || "System";

        const log: AuditLogEntry = {
            userId,
            userName,
            action,
            targetId,
            targetName,
            timestamp: Date.now(),
            metadata
        };

        await db.collection("audit_logs").add(log);
        console.log(`[AUDIT] ${action}: ${targetName} (${targetId}) by ${userName}`);
    } catch (e) {
        console.error("Failed to write audit log:", e);
        // Fallback or silent fail to prevent blocking main flow? 
        // Ideally should be robust, but better not to crash the user's action.
    }
}

export async function getAuditLogs(limit = 50) {
    const snap = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry & { id: string }));
}
