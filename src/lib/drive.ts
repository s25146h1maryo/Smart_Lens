import "server-only";
import { google } from "googleapis";
import { withRetry } from "./retry";
export { withRetry };

// Scopes for Drive API
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Initialize Auth Client (Service Account - Fallback)
// Helper to clean private key (Duplicated from firebase.ts for consistency)
const getPrivateKey = () => {
    let key = process.env.FIREBASE_PRIVATE_KEY;
    if (!key) return undefined;
    
    // 0. Base64 Check
    if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
        try {
            key = Buffer.from(key, 'base64').toString('utf8');
        } catch (e) {
            // ignore
        }
    }
    // 1. Remove quotes
    if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
    }
    // 2. Replace escaped slashes
    key = key.replace(/\\n/g, "\n");
    return key;
};

// Initialize Auth Client (Service Account - Fallback)
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: getPrivateKey(),
    },
    scopes: SCOPES,
});

// Helper to get authenticated client (User or SA)
export const getDriveClient = (accessToken?: string) => {
    if (accessToken) {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return google.drive({ version: 'v3', auth: oauth2Client });
    }
    return google.drive({ version: "v3", auth });
};

export const ROOT_FOLDER_ID = process.env.TARGET_DRIVE_ROOT_FOLDER_ID;

/**
 * Creates a new folder.
 */
export async function createFolder(name: string, parentId: string = ROOT_FOLDER_ID!, accessToken?: string) {
    const drive = getDriveClient(accessToken);
    return withRetry(async () => {
        const res = await drive.files.create({
            requestBody: {
                name,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentId],
            },
            fields: "id, name, webViewLink",
            supportsAllDrives: true,
        });
        return res.data;
    });
}

/**
 * Grants a user permission (SA Logic Only - Deprecated for User Mode but kept for legacy)
 */
export async function grantPermission(
    fileId: string,
    email: string,
    role: "reader" | "writer" | "commenter"
) {
    const drive = getDriveClient(); // Always SA for now
    return withRetry(async () => {
        await drive.permissions.create({
            fileId,
            requestBody: {
                role,
                type: "user",
                emailAddress: email,
            },
            sendNotificationEmail: false,
        });
    });
}

export async function revokePermission(fileId: string, email: string) {
    const drive = getDriveClient();
    const permissions = await withRetry(async () => {
        const res = await drive.permissions.list({
            fileId,
            fields: "permissions(id, emailAddress)",
        });
        return res.data.permissions || [];
    });

    const permission = permissions.find((p) => p.emailAddress === email);

    if (permission?.id) {
        await withRetry(async () => {
            await drive.permissions.delete({
                fileId,
                permissionId: permission.id!,
            });
        });
    }
}

export async function moveFile(fileId: string, newParentId: string, accessToken?: string) {
    const drive = getDriveClient(accessToken);
    const file = await withRetry(async () => {
        const res = await drive.files.get({
            fileId,
            fields: "parents",
            supportsAllDrives: true,
        });
        return res.data;
    });

    const previousParents = file.parents?.join(",") || "";

    await withRetry(async () => {
        await drive.files.update({
            fileId,
            addParents: newParentId,
            removeParents: previousParents,
            fields: "id, parents",
            supportsAllDrives: true,
        });
    });
}

/**
 * Generates a Resumable Upload URL.
 */
export async function getResumableUploadUrl(
    fileName: string,
    mimeType: string,
    parentId: string,
    accessToken?: string
) {
    let tokenString = accessToken;

    if (!tokenString) {
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        tokenString = token.token || (token as unknown as string);
    }

    if (!tokenString) throw new Error("Failed to get access token");

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,size,md5Checksum,thumbnailLink", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${tokenString}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": mimeType,
            // "X-Upload-Content-Length": "", 
        },
        body: JSON.stringify({
            name: fileName,
            parents: [parentId],
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to get upload session: ${res.statusText} ${txt}`);
    }

    return res.headers.get("Location");
}

export async function listFiles(folderId: string, accessToken?: string) {
    if (!folderId) return [];
    const drive = getDriveClient(accessToken);
    
    return withRetry(async () => {
        try {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink)",
                orderBy: "createdTime desc",
                supportsAllDrives: true,
                includeItemsFromAllDrives: true, 
            });
            return res.data.files || [];
        } catch (error: any) {
            console.error("List Files Error:", error);
            // Don't swallow auth errors, letting them propagate might be better for debugging
            // But for now, returning empty is safe for UI
            return []; 
        }
    });
}

// export { drive as adminDrive }; // Removed due to refactor

export async function deleteFile(fileId: string, accessToken?: string) {
    const drive = getDriveClient(accessToken);
    return withRetry(async () => {
        await drive.files.delete({
            fileId,
            supportsAllDrives: true,
        });
    });
}
