"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { Task } from "@/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { ensureSystemStructure, findOrCreateFolder } from "@/lib/drive_structure";
import { moveFile, grantPermission, deleteFile } from "@/lib/drive";
import { logger } from "@/lib/logger";

export async function createTask(
    threadId: string, 
    title: string, 
    status: Task['status'] = 'todo',
    data: Partial<Omit<Task, 'id' | 'threadId' | 'title' | 'status' | 'createdAt'>> = {}
): Promise<{ success: boolean; task?: Task; error?: { code: string; message: string } }> {
    try {
        const session = await auth();
        if (!session) {
            return { success: false, error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' } };
        }

        if (!title.trim()) {
            return { success: false, error: { code: 'VALIDATION_ERROR', message: 'タイトルは必須です' } };
        }

        // Capture all needed values early
        // @ts-ignore
        const accessToken = session.accessToken as string;
        const userEmail = session.user?.email;
        const userId = session.user?.id;
        const attachmentsToMove = data.attachments ? [...data.attachments] : [];

        const taskRef = db.collection("tasks").doc();
        const safeTitle = title.replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-_]/g, '').trim() || "Untitled";
        const folderName = `Task_${safeTitle}_${taskRef.id.substring(0, 4)}`;

        // --- Drive Folder Creation ---
        let driveFolderId: string | undefined = undefined;
        try {
             // 1. Get Parent Thread Folder
             const threadDoc = await db.collection("threads").doc(threadId).get();
             const threadData = threadDoc.data();
             const parentFolderId = threadData?.driveFolderId;

             if (parentFolderId) {
                 driveFolderId = await findOrCreateFolder(folderName, parentFolderId);
             } else {
                 // Fallback to Threads Root if Parent missing (Legacy/Error)
                 const sys = await ensureSystemStructure();
                 driveFolderId = await findOrCreateFolder(folderName, sys.threadsRootId);
             }
             await logger.info("Task Folder Created", { folderName, driveFolderId, threadId });
        } catch (e) {
            await logger.error("Task Drive Folder Creation Failed", { error: e, threadId });
        }

        const newTask: Task = {
            id: taskRef.id,
            threadId,
            title,
            status,
            priority: data.priority || 'medium',
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            dueDate: data.dueDate ?? null,
            assigneeIds: data.assigneeIds || [],
            isAllDay: data.isAllDay ?? true,
            attachments: attachmentsToMove,
            driveFolderId,
            createdAt: Date.now()
        };
        
        // Explicitly grant writer permission to the creator (Synchronous)
        // This ensures the "Privilege Flow" is established before we attempt any move.
        if (driveFolderId && userEmail) {
            try {
                await grantPermission(driveFolderId, userEmail, "writer");
                await logger.info("Granted permission", { userEmail, driveFolderId });
            } catch (permErr) {
                await logger.warn("Permission grant warning", { error: permErr });
            }
        }

        await taskRef.set(newTask);
        await logger.info("Saved task", { taskId: newTask.id, title });

        // --- Send push notification to assignees ---
        if (newTask.assigneeIds && newTask.assigneeIds.length > 0) {
            try {
                const { sendPushNotification } = await import("@/lib/push");
                await sendPushNotification(
                    newTask.assigneeIds,
                    "新しいタスクが割り当てられました",
                    title,
                    `/thread/${threadId}`,
                    `task-${newTask.id}`,
                    'taskAssignment'
                );
            } catch (pushErr) {
                await logger.warn("Push notification failed", { error: pushErr });
            }
        }

        // --- SYNCHRONOUS File Move (with delay for permission propagation) ---
        if (driveFolderId && attachmentsToMove.length > 0 && accessToken) {
            await logger.info(`Moving ${attachmentsToMove.length} attachments`, { attachments: attachmentsToMove }, `Task:${newTask.id}`);
            
            // Wait 2 seconds for permission to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            for (const att of attachmentsToMove) {
                // Cast to any for flexible property access from different sources
                const a = att as any;
                // Google Drive File ID can be in different properties depending on source
                const driveFileId = a.driveFileId || a.driveId || a.id;
                
                if (driveFileId) {
                    try {
                        // 1. Move Physical File in Drive
                        await logger.info(`Moving file ${driveFileId} to ${driveFolderId}`, null, `Task:${newTask.id}`);
                        await moveFile(driveFileId, driveFolderId, accessToken);
                        await logger.info(`File ${driveFileId} moved successfully`, null, `Task:${newTask.id}`);

                        // 2. Register/Update in Firestore (SmartLens File System)
                        const existingQuery = await db.collection("files").where("gcsPath", "==", driveFileId).get();
                        
                        let fileRef;
                        if (!existingQuery.empty) {
                            fileRef = existingQuery.docs[0].ref;
                        } else {
                            fileRef = db.collection("files").doc();
                        }

                        // Create the File Record linked to this Task
                        await fileRef.set({
                            id: fileRef.id,
                            name: a.name,
                            type: 'file',
                            mimeType: a.mimeType || a.type || 'application/octet-stream',
                            size: a.size || 0,
                            parentId: driveFolderId,
                            ownerId: userId,
                            path: ['Threads', folderName],
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            gcsPath: driveFileId,
                            webViewLink: a.webViewLink || a.url,
                            isTrashed: false,
                            taskId: newTask.id
                        }, { merge: true });
                        await logger.info(`File ${driveFileId} registered in Firestore`, null, `Task:${newTask.id}`);
                    } catch (moveErr) {
                        await logger.error(`Failed to move file ${driveFileId}`, { error: moveErr }, `Task:${newTask.id}`);
                        // Continue with other files even if one fails
                    }
                } else {
                    await logger.warn("Attachment has no valid drive file ID", { attachment: a }, `Task:${newTask.id}`);
                }
            }
            await logger.info("All attachments processed", null, `Task:${newTask.id}`);
        }

        revalidatePath(`/thread/${threadId}`);
        revalidateTag('tasks', 'max');
        return { success: true, task: newTask };
    } catch (e: any) {
        await logger.error("createTask Error", { error: e }, `Thread:${threadId}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || '不明なエラーが発生しました' } };
    }
}

export async function updateTaskStatus(taskId: string, threadId: string, status: Task['status']) {
     const session = await auth();
     if (!session) throw new Error("Unauthorized");

     await db.collection("tasks").doc(taskId).update({ status });
     revalidatePath(`/thread/${threadId}`);
     revalidateTag('tasks', 'max');
}

export async function updateTask(
    taskId: string,
    threadId: string,
    data: Partial<Task>
): Promise<{ success: boolean; error?: string }> {
     try {
         const session = await auth();
         if (!session) return { success: false, error: "Unauthorized" };
         
         const updates = { ...data };
         delete (updates as any).id;
         delete (updates as any).threadId;
         delete (updates as any).createdAt;

         await db.collection("tasks").doc(taskId).update(updates);
         revalidatePath(`/thread/${threadId}`);
         revalidateTag('tasks', 'max');
         return { success: true };
     } catch (e: any) {
         await logger.error("updateTask Error", { error: e }, `Task:${taskId}`);
         return { success: false, error: e.message };
     }
}

const admin = require("firebase-admin");

export async function deleteTask(taskId: string, threadId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session) return { success: false, error: "Unauthorized" };

        await db.collection("tasks").doc(taskId).delete();
        revalidatePath(`/thread/${threadId}`);
        revalidateTag('tasks', 'max');
        return { success: true };
    } catch (e: any) {
        await logger.error("deleteTask Error", { error: e }, `Task:${taskId}`);
        return { success: false, error: e.message };
    }
}

export async function addTaskAttachment(taskId: string, threadId: string, attachment: unknown) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");
    
    // SECURITY: Import and validate attachment data
    const { TaskAttachmentSchema } = await import("@/lib/schemas");
    
    const validationResult = TaskAttachmentSchema.safeParse(attachment);
    if (!validationResult.success) {
        throw new Error("Invalid attachment data: " + validationResult.error.message);
    }
    
    const validatedAttachment = validationResult.data;
    
    await db.collection("tasks").doc(taskId).update({
        attachments: admin.firestore.FieldValue.arrayUnion(validatedAttachment)
    });
    revalidatePath(`/thread/${threadId}`);
    revalidateTag('tasks', 'max');
}

// --- Archiving & Cleanup ---

export async function autoArchiveTasks(threadId: string) {
    const session = await auth();
    if (!session) return;

    // Active Done Tasks -> Check if > 3 days
    // 3 days = 3 * 24 * 60 * 60 * 1000 = 259200000 ms
    const CUTOFF = Date.now() - 259200000;

    const snap = await db.collection("tasks")
        .where("threadId", "==", threadId)
        .where("status", "==", "done")
        .get();

    if (snap.empty) return;

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach((doc) => {
        const t = doc.data() as Task;
        if (t.updatedAt && t.updatedAt < CUTOFF) {
            batch.update(doc.ref, { status: "archived" });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        revalidatePath(`/thread/${threadId}`);
        revalidateTag('tasks', 'max');
    }
}

export async function restoreTask(taskId: string, threadId: string) {
     const session = await auth();
     if (!session) throw new Error("Unauthorized");

     await db.collection("tasks").doc(taskId).update({ 
         status: 'todo',
         updatedAt: Date.now()
     });
     revalidatePath(`/thread/${threadId}`);
     revalidateTag('tasks', 'max');
}

export async function deleteTaskPermanent(taskId: string, threadId: string) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) return;

    const task = taskDoc.data() as Task;

    // Delete Drive Folder and associated Files
    if (task.driveFolderId) {
        // 1. Delete associated Files in Firestore (by parentId matches Folder)
        const filesSnap = await db.collection("files").where("parentId", "==", task.driveFolderId).get();
        if (!filesSnap.empty) {
            const batchFiles = db.batch();
            filesSnap.docs.forEach(d => batchFiles.delete(d.ref));
            await batchFiles.commit();
        }

        // 2. Delete Drive Folder
        try {
            await deleteFile(task.driveFolderId);
        } catch (e) {
            await logger.warn(`Failed to delete Drive folder`, { error: e }, `Task:${taskId}`);
        }
    }

    // 3. Delete Task Doc
    await taskRef.delete();

    revalidatePath(`/thread/${threadId}`);
    revalidateTag('tasks', 'max');
}

export async function deleteAllArchivedTasks(threadId: string) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const snap = await db.collection("tasks")
        .where("threadId", "==", threadId)
        .where("status", "==", "archived")
        .get();

    if (snap.empty) return;

    await Promise.all(snap.docs.map(doc => deleteTaskPermanent(doc.id, threadId)));
    
    revalidatePath(`/thread/${threadId}`);
    revalidateTag('tasks', 'max');
}
