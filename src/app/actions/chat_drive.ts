"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { ensureGroupDriveStructure, ensureDMDriveStructure, createMessageFolder } from "@/lib/drive_structure";
import { getDriveClient, getResumableUploadUrl, withRetry } from "@/lib/drive";

// 1. Prepare Local Upload (Get URL)
// Supports both Group chats and DMs
export async function prepareChatUpload(
    chatId: string, 
    groupName: string, // Or recipient name for DM (not used for folder naming anymore)
    participants: string[], // IDs
    fileName: string, 
    mimeType: string,
    fileSize: number
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    // @ts-ignore
    const accessToken = session.accessToken as string;

    // 1. Resolve Emails for ACL
    const userDocs = await Promise.all(participants.map(uid => db.collection("users").doc(uid).get()));
    const participantEmails = userDocs.map(doc => doc.data()?.email).filter(Boolean) as string[];
    
    // Always include ROOT and current user
    if (session.user.email && !participantEmails.includes(session.user.email)) {
        participantEmails.push(session.user.email);
    }
    const ROOT_EMAIL = "s25146@hon1.ed.jp";
    if (!participantEmails.includes(ROOT_EMAIL)) participantEmails.push(ROOT_EMAIL);

    // 2. Determine Chat Type and Ensure Folder Structure
    // Check if this is a DM (2 participants) or Group (more than 2 or explicit group chat)
    let parentFolderId: string;
    
    // DM chatIds are usually formatted as "uid1_uid2" sorted
    const isDM = participants.length === 2 && chatId.includes("_") && !chatId.startsWith("group_");
    
    if (isDM) {
        // Use PEOPLE folder for DM files
        const { dmFolderId } = await ensureDMDriveStructure(chatId, participantEmails, participants);
        parentFolderId = dmFolderId;
    } else {
        // Use GROUPS folder for group chat files
        const { groupFolderId } = await ensureGroupDriveStructure(chatId, groupName, participantEmails);
        parentFolderId = groupFolderId;
    }

    // 3. Create Message Specific Folder (Sender_Timestamp)
    const messageFolderId = await createMessageFolder(parentFolderId, session.user.id);

    // 4. Get Upload URL
    const uploadUrl = await getResumableUploadUrl(fileName, mimeType, messageFolderId, accessToken);

    return { uploadUrl, messageFolderId };
}

// 2. Share Existing Drive Files (Copy)
export async function shareDriveFilesToChat(
    chatId: string, 
    groupName: string,
    participants: string[],
    fileIds: string[]
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    // @ts-ignore
    const accessToken = session.accessToken as string;

    // 1. Resolve Emails & Structure (Same as above)
    const userDocs = await Promise.all(participants.map(uid => db.collection("users").doc(uid).get()));
    const participantEmails = userDocs.map(doc => doc.data()?.email).filter(Boolean) as string[];
    const ROOT_EMAIL = "s25146@hon1.ed.jp";
    if (session.user.email && !participantEmails.includes(session.user.email)) participantEmails.push(session.user.email);
    if (!participantEmails.includes(ROOT_EMAIL)) participantEmails.push(ROOT_EMAIL);

    // 2. Determine Chat Type and Ensure Folder Structure
    let parentFolderId: string;
    const isDM = participants.length === 2 && chatId.includes("_") && !chatId.startsWith("group_");
    
    if (isDM) {
        const { dmFolderId } = await ensureDMDriveStructure(chatId, participantEmails, participants);
        parentFolderId = dmFolderId;
    } else {
        const { groupFolderId } = await ensureGroupDriveStructure(chatId, groupName, participantEmails);
        parentFolderId = groupFolderId;
    }
    
    const messageFolderId = await createMessageFolder(parentFolderId, session.user.id);

    // 2. Copy Files (USER performs the copy to access their own files)
    const drive = getDriveClient(accessToken); // User Client
    
    const results = await Promise.all(fileIds.map(async (fileId) => {
        try {
            return await withRetry(async () => {
                // Get original metadata first
                const original = await drive.files.get({ 
                    fileId, 
                    fields: 'name, mimeType',
                    supportsAllDrives: true // Important for shared drives or strict access
                });
                
                // Copy
                const copyRes = await drive.files.copy({
                    fileId,
                    requestBody: {
                        name: original.data.name, // Keep name
                        parents: [messageFolderId]
                    },
                    fields: 'id, name, mimeType, webViewLink, size, iconLink, thumbnailLink',
                    supportsAllDrives: true
                });
                
                return {
                    id: copyRes.data.id,
                    name: copyRes.data.name,
                    mimeType: copyRes.data.mimeType,
                    url: copyRes.data.webViewLink,
                    thumbnailLink: copyRes.data.thumbnailLink || null,
                    driveId: copyRes.data.id,
                    size: parseInt(copyRes.data.size || '0'), // Copy might not return size immediately?
                    type: copyRes.data.mimeType || 'file' // Use MimeType for preview logic
                };
            });
        } catch (e) {
            console.error(`Failed to copy file ${fileId}`, e);
            return null;
        }
    }));

    return results.filter(Boolean);
}
