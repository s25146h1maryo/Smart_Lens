"use server";

import { auth } from "@/auth";
import { db, adminApp } from "@/lib/firebase";
import { getDatabase } from "firebase-admin/database";
import { getDriveClient } from "@/lib/drive";
import { logAuditAction } from "@/lib/audit";
import { SYSTEM_ROOT_NAME } from "@/lib/drive_structure";
import { logger } from "@/lib/logger";

// RTDB URL
const RTDB_URL = "https://smartlens-facd7-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function resetSystem() {
    const session = await auth();
    if (session?.user?.role !== "ROOT") {
        throw new Error("Access Denied: Only ROOT can reset the system.");
    }

    await logger.warn("!!! SYSTEM RESET INITIATED !!!", { user: session.user.email });

    const errors: string[] = [];

    // 1. Wipe Firestore Collections
    // CRITICAL: Include ALL collections that store user/app data
    const collections = ["users", "threads", "files", "audit_logs", "groups", "tasks", "chats"];
    
    const deleteCollection = async (colName: string) => {
        try {
            await logger.info(`[Reset] Deleting Firestore collection: ${colName}...`);
            const snapshot = await db.collection(colName).get();
            if (snapshot.empty) {
                await logger.info(`[Reset] Collection ${colName} is already empty.`);
                return;
            }
            
            await logger.info(`[Reset] Found ${snapshot.size} docs in ${colName}. Deleting...`);
            
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            await logger.info(`[Reset] Deleted ${snapshot.size} docs from ${colName}`, { collection: colName, count: snapshot.size });
            
            // Verify
            const verifySnap = await db.collection(colName).get();
            if (!verifySnap.empty) {
                throw new Error(`Failed to verify empty state for ${colName}. ${verifySnap.size} docs remain.`);
            }
        } catch (e) {
            await logger.error(`Failed to delete ${colName}`, { error: e });
            errors.push(`Firestore ${colName}: ${e}`);
        }
    };

    await Promise.all(collections.map(c => deleteCollection(c)));

    // 2. Wipe Realtime Database (RTDB)
    // CRITICAL: Include ALL RTDB nodes
    try {
        await logger.info("[Reset] Deleting Realtime Database...");
        const rtdb = getDatabase(adminApp);
        
        // Delete all root nodes in RTDB - include new nodes
        const rtdbRoots = ["attendance", "messages", "status", "lastSeen", "typing", "chatMeta"];
        
        for (const rootNode of rtdbRoots) {
            try {
                await rtdb.ref(rootNode).remove();
                await logger.info(`[Reset] Deleted RTDB node: ${rootNode}`);
            } catch (e) {
                await logger.info(`[Reset] RTDB node ${rootNode} may not exist or failed`, { error: e });
                // Don't add to errors - node might not exist
            }
        }
        
        await logger.info("[Reset] Realtime Database cleanup complete.");
    } catch (e) {
        await logger.error("RTDB Wipe Failed", { error: e });
        errors.push(`RTDB: ${e}`);
    }

    // 3. Wipe Google Drive
    try {
        const drive = getDriveClient();
        
        const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${SYSTEM_ROOT_NAME}' and trashed = false`;
        const res = await drive.files.list({ q, fields: "files(id)" });
        
        if (res.data.files && res.data.files.length > 0) {
            for (const f of res.data.files) {
                await drive.files.delete({ fileId: f.id! });
                await logger.info(`[Reset] Deleted Drive Folder: ${f.id}`);
            }
        }
        await logger.info("[Reset] Google Drive cleanup complete.");
    } catch (e) {
        await logger.error("Drive Wipe Failed", { error: e });
        errors.push(`Drive: ${e}`);
    }

    // 4. Log the event (Will be the first log after reset)
    try {
        await logAuditAction("SYSTEM_RESET", "SYSTEM", "ALL_DATA", { by: session.user.email });
    } catch (e) {
        // Ignore
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }
    
    return { success: true };
}
