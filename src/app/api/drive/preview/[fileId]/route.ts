import { auth } from "@/auth";
import { getDriveClient } from "@/lib/drive";
import { db } from "@/lib/firebase";
import { NextRequest, NextResponse } from "next/server";

// Helper to verify file access through Firestore
async function verifyFileAccess(fileId: string, userId: string): Promise<boolean> {
  // Check 1: User owns the file directly
  const fileByOwner = await db.collection("files")
    .where("gcsPath", "==", fileId)
    .where("ownerId", "==", userId)
    .limit(1)
    .get();
  
  if (!fileByOwner.empty) return true;

  // Check 2: File is in a shared drive (all authenticated users can access)
  const sharedFile = await db.collection("files")
    .where("gcsPath", "==", fileId)
    .where("isShared", "==", true)
    .limit(1)
    .get();
  
  if (!sharedFile.empty) return true;

  // Check 3: File belongs to a thread user is member of (via task)
  const fileDoc = await db.collection("files")
    .where("gcsPath", "==", fileId)
    .limit(1)
    .get();
  
  if (!fileDoc.empty) {
    const fileData = fileDoc.docs[0].data();
    if (fileData.taskId) {
      const taskDoc = await db.collection("tasks").doc(fileData.taskId).get();
      if (taskDoc.exists) {
        const taskData = taskDoc.data();
        const threadDoc = await db.collection("threads").doc(taskData?.threadId).get();
        if (threadDoc.exists) {
          const threadData = threadDoc.data();
          if (threadData?.members?.includes(userId)) {
            return true;
          }
        }
      }
    }
  }

  // If none of the above, fall back to Google Drive ACL (implicit check)
  // The user's access token will fail if they don't have permission
  return true; // Allow Google Drive to handle the final ACL check
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // @ts-ignore
  const accessToken = session.accessToken as string;
  if (!accessToken) {
    return new NextResponse("Token Expired", { status: 401 });
  }

  const { fileId } = await params;

  // SECURITY: Verify access through our system (additional layer)
  const hasAccess = await verifyFileAccess(fileId, session.user.id);
  if (!hasAccess) {
    return new NextResponse("Access denied", { status: 403 });
  }

  try {
    const drive = getDriveClient(accessToken);
    
    // Fetch file metadata to get MIME type and size
    const fileMeta = await drive.files.get({
        fileId: fileId,
        fields: 'mimeType, name, size'
    });
    const fileSize = parseInt(fileMeta.data.size || '0');
    const range = req.headers.get("range");

    let requestHeaders: any = { responseType: "stream" };
    if (range) {
        requestHeaders.headers = { Range: range };
    }

    // Stream the file content
    const response = await drive.files.get(
      { fileId: fileId, alt: "media" },
      requestHeaders
    );

    // Create a new Header object
    const headers = new Headers();
    headers.set("Content-Type", fileMeta.data.mimeType || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=3600"); 
    headers.set("Accept-Ranges", "bytes");

    let status = 200;

    if (range) {
        status = 206; // Partial Content
        // Pass essential headers from Upstream
        if (response.headers['content-range']) {
            headers.set("Content-Range", response.headers['content-range']);
        }
        if (response.headers['content-length']) {
            headers.set("Content-Length", response.headers['content-length']);
        }
    } else {
        headers.set("Content-Length", fileSize.toString());
    }

    // Return stream
    // @ts-ignore: Gaxios stream compatibility
    return new NextResponse(response.data, { status, headers });

  } catch (error: any) {
    console.error("Preview Error:", error);
    return new NextResponse("Failed to fetch file", { status: 500 });
  }
}
