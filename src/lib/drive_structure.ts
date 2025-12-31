import "server-only";
import { db } from "@/lib/firebase";
import { getDriveClient, grantPermission } from "./drive";

/**
 * SmartLens Drive Architecture V3
 * =============================
 * 
 * Root: SmartLens_Data (Shared with ROOT Admin)
 *   ├── Shared_Drive  ← NEW: 全ユーザーアクセス可能
 *   ├── AI_Cache (For AI intermediates)
 *   ├── User_MyDrive
 *   │     └── [User] Name_UID (Shared with User)
 *   │           └── My_Files (App Root)
 *   ├── Threads
 *   │     └── Task_Title_ID (Task Attachments)
 *   └── People
 */

export const SYSTEM_ROOT_NAME = "SmartLens_Data";

// ... (Existing Imports)

export const FOLDER_NAMES = {
    SHARED_DRIVE: "Shared_Drive",  // 全員アクセス可能な共有ドライブ
    AI_CACHE: "AI_Cache",
    USERS_ROOT: "User_MyDrive",
    THREADS_ROOT: "Threads",
    USER_MY_FILES: "My_Files",
    GROUPS_ROOT: "Groups",
    PEOPLE_ROOT: "People" // For DM file storage
} as const;

const ROOT_EMAIL = "s25146@hon1.ed.jp"; 

/**
 * 1. Ensures the Global System Structure exists.
 */
export async function ensureSystemStructure() {
    let rootId = process.env.TARGET_DRIVE_ROOT_FOLDER_ID;

    // 1. Root
    if (!rootId || !(await checkFolderExists(rootId))) {
         rootId = await findOrCreateFolder(SYSTEM_ROOT_NAME, 'root');
    }
    
    // **ACL Enforcement**: Grant ROOT access to the Top Level Folder
    try {
        await grantPermission(rootId, ROOT_EMAIL, "writer");
    } catch(e) {
        // console.warn("ACL Warning (Root):", e);
    }

    // 2. Global Folders inside Root
    const [sharedDriveId, aiCacheId, usersRootId, threadsRootId, peopleRootId] = await Promise.all([
        findOrCreateFolder(FOLDER_NAMES.SHARED_DRIVE, rootId),
        findOrCreateFolder(FOLDER_NAMES.AI_CACHE, rootId),
        findOrCreateFolder(FOLDER_NAMES.USERS_ROOT, rootId),
        findOrCreateFolder(FOLDER_NAMES.THREADS_ROOT, rootId),
        findOrCreateFolder(FOLDER_NAMES.PEOPLE_ROOT, rootId)
    ]);

    return { rootId, sharedDriveId, aiCacheId, usersRootId, threadsRootId, peopleRootId };
}

/**
 * 2. Ensures a specific User's Private Folder exists.
 */
export async function ensureUserDriveStructure(userId: string, email: string, displayName: string) {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const driveIds = userData?.driveIds || {};

    // 1. Ensure System Infrastructure
    const system = await ensureSystemStructure();

    // 2. User Private Folder
    // Name: [User] DisplayName_UID
    // Ensure safe name
    const safeName = (displayName || "User").replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-_]/g, '').trim() || "User";
    const userFolderName = `[User] ${safeName}_${userId.substring(0, 6)}`;
    
    let userRootId = driveIds.userRoot;
    
    // Check existence
    if (!userRootId || !(await checkFolderExists(userRootId))) {
        // Create in "User_MyDrive"
        userRootId = await findOrCreateFolder(userFolderName, system.usersRootId);
        
        // **ACL**: Grant User Access (Strict: Owner=SA, Writer=User)
        if (email) {
            try {
                await grantPermission(userRootId, email, "writer");
            } catch (e) {
                console.error("User ACL Failed", e);
            }
        }
    }
    driveIds.userRoot = userRootId;
    driveIds.root = system.rootId; 

    // 3. My_Files (Content Root) - Mirroring App Structure
    let myFilesId = driveIds.myFiles;
    if (!myFilesId || !(await checkFolderExists(myFilesId))) {
        myFilesId = await findOrCreateFolder(FOLDER_NAMES.USER_MY_FILES, userRootId);
        // Note: Inherits User Access from userRootId
    }
    driveIds.myFiles = myFilesId;

    // Save
    if (driveIds.userRoot !== userData?.driveIds?.userRoot || driveIds.myFiles !== userData?.driveIds?.myFiles) {
        await userRef.set({ driveIds }, { merge: true });
    }

    return { 
        root: system.rootId, 
        userRoot: userRootId, 
        myFiles: myFilesId,
        threads: system.threadsRootId, // Expose for Task usage
        aiCache: system.aiCacheId
    };
}

/**
 * 3. Ensures a Group Folder exists with correct permissions.
 * Path: SmartLens_Data/Groups/[GroupName]_[ChatID]
 */
export async function ensureGroupDriveStructure(chatId: string, groupName: string, participantEmails: string[]) {
    // 1. Ensure System Infrastructure
    const system = await ensureSystemStructure();

    // 2. Ensure Groups Root exists
    const groupsRootId = await findOrCreateFolder(FOLDER_NAMES.GROUPS_ROOT, system.rootId);

    // 3. Ensure Specific Group Folder
    // Naming: [GroupName]_[ChatID]
    const safeName = (groupName).replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-_]/g, '').trim() || "Group";
    const folderName = `${safeName}_${chatId}`;
    
    // Check/Create directly
    const groupFolderId = await findOrCreateFolder(folderName, groupsRootId);

    // 4. Update Permissions (ACL)
    // Grant 'writer' access to all participants
    // Note: We don't remove old participants here for simplicity, but we ensure current ones have access.
    // Ideally, we should sync full list.
    const promises = participantEmails.map(async (email) => {
        if (!email) return;
        try {
            await grantPermission(groupFolderId, email, "writer");
        } catch (e) {
            console.error(`Failed to grant group access to ${email}:`, e);
        }
    });

    await Promise.all(promises);

    return { groupFolderId };
}

/**
 * 4. Ensures a DM (Direct Message) Folder exists with correct permissions.
 * Path: SmartLens_Data/People/DM_[sortedUID1]_[sortedUID2]
 * Uses sorted UIDs instead of names for name-change resilience.
 */
export async function ensureDMDriveStructure(chatId: string, participantEmails: string[], participantUids: string[]) {
    // 1. Ensure System Infrastructure
    const system = await ensureSystemStructure();

    // 2. Ensure People Root exists
    const peopleRootId = await findOrCreateFolder(FOLDER_NAMES.PEOPLE_ROOT, system.rootId);

    // 3. Ensure Specific DM Folder
    // Naming: DM_[UID1]_[UID2] (sorted for consistency)
    const sortedUids = [...participantUids].sort();
    const folderName = `DM_${sortedUids.join('_')}`;
    
    // Check/Create directly
    const dmFolderId = await findOrCreateFolder(folderName, peopleRootId);

    // 4. Update Permissions (ACL)
    // Grant 'writer' access to participants
    const promises = participantEmails.map(async (email) => {
        if (!email) return;
        try {
            await grantPermission(dmFolderId, email, "writer");
        } catch (e) {
            console.error(`Failed to grant DM access to ${email}:`, e);
        }
    });

    await Promise.all(promises);

    return { dmFolderId };
}

/**
 * 5. Ensures a Task Folder exists with correct permissions.
 * Path: SmartLens_Data/Threads/Task_[SafeTitle]_[TaskID]
 * Owner: SA. ACL: Creator=Writer, Root=Writer.
 */
export async function ensureTaskDriveStructure(taskId: string, taskTitle: string, creatorEmail: string) {
    const system = await ensureSystemStructure();
    
    // 1. Ensure Threads Root
    // The Threads Root essentially needs to be accessible by SA (Owner)
    // We create task folders inside here.
    const threadsRootId = await findOrCreateFolder(FOLDER_NAMES.THREADS_ROOT, system.rootId);

    // 2. Task Folder
    const safeTitle = taskTitle.replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-_]/g, '').trim() || "Untitled";
    const folderName = `Task_${safeTitle}_${taskId.substring(0, 4)}`;
    
    const taskFolderId = await findOrCreateFolder(folderName, threadsRootId); // SA creates

    // 3. ACL
    // Grant Writer to Creator
    if (creatorEmail) {
        try {
            await grantPermission(taskFolderId, creatorEmail, "writer");
        } catch (e) {
            console.warn(`Failed to grant task folder access to ${creatorEmail}`, e);
        }
    }
    // Grant Writer to ROOT
    try {
        await grantPermission(taskFolderId, ROOT_EMAIL, "writer");
    } catch(e) {}

    return taskFolderId;
}

/**
 * 6. Ensures a Thread Folder exists with correct permissions.
 * Path: SmartLens_Data/ThreadsRoot/Threads_[SafeTitle]_[ThreadID]
 * Owner: SA. ACL: Creator=Writer, ROOT=Writer.
 */
export async function ensureThreadDriveStructure(threadId: string, threadTitle: string, creatorEmail: string) {
    const system = await ensureSystemStructure();
    
    // 1. Ensure Threads Root
    const threadsRootId = await findOrCreateFolder(FOLDER_NAMES.THREADS_ROOT, system.rootId);

    // 2. Thread Folder
    const safeTitle = threadTitle.replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-_]/g, '').trim() || "Thread";
    const folderName = `Threads_${safeTitle}_${threadId.substring(0, 4)}`;
    
    // SA creates the folder
    const threadFolderId = await findOrCreateFolder(folderName, threadsRootId);

    // 3. ACL
    const aclPromises = [];

    // Grant Writer to Creator
    if (creatorEmail) {
        aclPromises.push(
            grantPermission(threadFolderId, creatorEmail, "writer").catch(e => console.warn(`Failed to grant thread access to ${creatorEmail}`, e))
        );
    }
    // Grant Writer to ROOT
    aclPromises.push(
        grantPermission(threadFolderId, ROOT_EMAIL, "writer").catch(e => {})
    );

    await Promise.all(aclPromises);

    return threadFolderId;
}

/**
 * Creates a message-specific folder inside the group/DM folder.
 * Path: .../[FolderName]/[SenderID]_[Timestamp]
 */
export async function createMessageFolder(parentFolderId: string, senderId: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `${senderId}_${timestamp}`;
    const folderId = await findOrCreateFolder(folderName, parentFolderId);
    return folderId;
}
// ... (Existing Helpers)

/**
 * Checks if a folder exists (using Service Account).
 */
async function checkFolderExists(fileId: string): Promise<boolean> {
    if (!fileId) return false;
    const drive = getDriveClient(); // Always SA
    try {
        await drive.files.get({ fileId, fields: "id" });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Finds a folder by name in a parent, or creates it (using Service Account).
 */
export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const drive = getDriveClient(); // Always SA
    
    // 1. Search (Exact match, not trashed, Folder type)
    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`;
    
    const listRes = await drive.files.list({
        q,
        fields: "files(id, name)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
        return listRes.data.files[0].id!;
    }

    // 2. Create if not found
    const createRes = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId]
        },
        fields: "id",
        supportsAllDrives: true
    });

    if (!createRes.data.id) throw new Error(`Failed to create folder: ${name}`);
    return createRes.data.id;
}
