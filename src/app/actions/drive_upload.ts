"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { getResumableUploadUrl, getDriveClient } from "@/lib/drive";
import { ensureUserDriveStructure } from "@/lib/drive_structure";
import { logAuditAction } from "@/lib/audit";
import { DriveItem } from "@/types/drive";
import { logger } from "@/lib/logger";

// 1. Initialize Upload
export async function initializeUpload(name: string, type: string, parentId: string | null, size: number, isShared: boolean = false) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Use User Token to consume User's Storage Quota
    // Service Accounts have 0 quota and cannot own files in standard Drive.
    // @ts-ignore
    const accessToken = session.accessToken as string;
    
    // Debug Log
    await logger.debug("InitializeUpload", { user: session.user.email, hasToken: !!accessToken, tokenLen: accessToken?.length });

    if (!accessToken) throw new Error("Google Drive Access Token Missing. Please Re-login.");
    
    let googleParentId = "";

    if (isShared) {
        // Shared Drive Logic
        const { ensureSystemStructure } = await import("@/lib/drive_structure");
        const system = await ensureSystemStructure();
        
        if (parentId) {
            // Check if parentId is a folder in Firestore (Subfolder in Shared Drive)
            const pDoc = await db.collection("files").doc(parentId).get();
            if (pDoc.exists) {
                const d = pDoc.data();
                if (d?.gcsPath) googleParentId = d.gcsPath;
            } else {
                // If provided parentId is not in Firestore, check if it matches Shared Drive Root ID
                // (This happens if we pass raw Google Drive ID)
                if (parentId === system.sharedDriveId) {
                    googleParentId = system.sharedDriveId;
                } else {
                    // Fallback to Shared Drive Root if invalid parent
                    googleParentId = system.sharedDriveId;
                }
            }
        } else {
            // Default to Shared Drive Root
            googleParentId = system.sharedDriveId;
        }
    } else {
        // Private Drive Logic
        // 1. Ensure Structure Exists (Using SA for structure stability)
        const struct = await ensureUserDriveStructure(
            session.user.id, 
            session.user.email!, 
            session.user.name || "Unknown User"
        ); 

        // 2. Resolve Target Folder
        googleParentId = struct.myFiles; // Default to My_Files

        if (parentId) {
            // If user specified a folder in our app, use it.
            // We verify it exists and map to Google ID.
            const pDoc = await db.collection("files").doc(parentId).get();
            if (pDoc.exists) {
                const d = pDoc.data();
                if (d?.gcsPath) googleParentId = d.gcsPath;
            } else {
                // Case: Uploading to Root requested? -> My_Files
                if (parentId === 'root') googleParentId = struct.myFiles;
                // Case: Task Attachments -> Fallback to MyFiles as per new structure
                if (parentId === 'task_attachments') googleParentId = struct.myFiles;
            }
        }
    }

    // Generate Session URL acting as the USER
    // This ensures the upload counts against User Quota.
    const uploadUrl = await getResumableUploadUrl(name, type, googleParentId, accessToken);
    return { uploadUrl, googleParentId };
}

// 2. Upload Chunk (Relay via Server Action to bypass CORS)
// This runs on Vercel Server, effectively proxying the chunk to Google.
// Since it's one chunk at a time, it avoids the payload limit per request (provided chunk is small < 4MB).
export async function uploadChunk(uploadUrl: string, formData: FormData, contentRange: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const fileChunk = formData.get("chunk") as Blob;
    if (!fileChunk) throw new Error("No chunk data");

    const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Length": fileChunk.size.toString(),
            "Content-Range": contentRange,
        },
        body: fileChunk,
    });

    if (res.status === 308) {
        return { status: 308 };
    } else if (res.status === 200 || res.status === 201) {
        const gFile = await res.json();
        return { status: 200, data: gFile };
    } else {
        const text = await res.text();
        throw new Error(`Google Upload Error: ${res.status} ${text}`);
    }
}

// 3. Finalize (Integrity Link & Audit)
export async function finalizeUpload(name: string, type: string, parentId: string | null, gFile: any, isShared: boolean = false) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    // @ts-ignore
    const accessToken = session.accessToken as string;

    // 1. Create Firestore Document
    const newFileRef = db.collection("files").doc(); // Generate ID first
    const fsId = newFileRef.id;

    // Resolve Path logic (Simplified for flat/folder structure)
    let path: string[] = [];
    if (parentId && parentId !== 'root') {
        const pDoc = await db.collection("files").doc(parentId).get();
        if (pDoc.exists) path = [...(pDoc.data()?.path || []), parentId];
    }

    // Determine effective parentId for DB
    let dbParentId = parentId;
    if (isShared && !parentId) {
        const { ensureSystemStructure } = await import("@/lib/drive_structure");
        const system = await ensureSystemStructure();
        dbParentId = system.sharedDriveId;
    }

    const newFile: DriveItem = {
        id: fsId,
        name,
        type: 'file',
        mimeType: type,
        size: parseInt(gFile.size || '0'),
        parentId: dbParentId || null, 
        ownerId: session.user.id,
        path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        gcsPath: gFile.id,
        webViewLink: gFile.webViewLink || null,
        isTrashed: false,
        isShared: isShared,
        // Store Integrity Checksum locally
        // @ts-ignore
        md5Checksum: gFile.md5Checksum // Google returns this if requested? We need to request it.
    };

    // 2. Lock Integrity: Update Drive File with Firestore ID & Hash
    // We need to fetch/update the Drive file to set appProperties.
    let finalWebViewLink = gFile.webViewLink || null;

    try {
        // Use USER CLIENT to update their own file
        const drive = getDriveClient(accessToken);
        
        // Fetch Fresh Metadata explicitly to ensure webViewLink
        const freshMeta = await drive.files.get({
            fileId: gFile.id,
            fields: "webViewLink, md5Checksum"
        });

        if (freshMeta.data.webViewLink) {
            finalWebViewLink = freshMeta.data.webViewLink;
        }
        
        await drive.files.update({
            fileId: gFile.id,
            requestBody: {
                appProperties: {
                    fs_id: fsId,
                    app_hash: freshMeta.data.md5Checksum || gFile.md5Checksum || "pending"
                },
                description: `Linked to SmartLens ID: ${fsId}`
            }
        });
        
        // Add checksum to our DB record if present
        if (freshMeta.data.md5Checksum) {
            // @ts-ignore
            newFile.md5Checksum = freshMeta.data.md5Checksum;
        }

    } catch (e) {
        await logger.error("Integrity Lock Failed", { error: e }, `File:${name}`);
        await logAuditAction("TAMPER_DETECTED", fsId, name, { error: "Failed to enforce appProperties", details: e });
    }

    // Update webViewLink in newFile before saving
    newFile.webViewLink = finalWebViewLink;

    // 3. Save to DB
    await newFileRef.set(newFile);

    // Note: UPLOAD logging removed to save resources (private drive operations)

    return { success: true, item: newFile };
}
