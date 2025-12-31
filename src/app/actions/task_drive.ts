"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { getResumableUploadUrl } from "@/lib/drive";
import { ensureTaskDriveStructure } from "@/lib/drive_structure";
import { Task } from "@/types";

export async function prepareTaskUpload(
    taskId: string,
    threadId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    // @ts-ignore
    const accessToken = session.accessToken as string;
    const userEmail = session.user.email;

    // 1. Get Task and Thread Info
    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) throw new Error("Task not found");
    const taskData = taskDoc.data() as Task;

    let driveFolderId = taskData.driveFolderId;

    // 2. Ensure Task Folder Exists
    if (!driveFolderId) {
        driveFolderId = await ensureTaskDriveStructure(taskId, taskData.title, userEmail || "");

        // Update Task with new Folder ID
        await taskRef.update({ driveFolderId });
    }

    // 3. Get Upload URL
    // Upload directly to Task Folder
    const uploadUrl = await getResumableUploadUrl(fileName, mimeType, driveFolderId, accessToken);

    return { uploadUrl, driveFolderId };
}
