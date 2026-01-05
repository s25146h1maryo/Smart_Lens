"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { createFolder, getResumableUploadUrl, grantPermission, ROOT_FOLDER_ID, deleteFile } from "@/lib/drive";
import { ensureSystemStructure, findOrCreateFolder, ensureThreadDriveStructure } from "@/lib/drive_structure";
import { CreateThreadSchema } from "@/lib/schemas";
import { Thread, ThreadStatus } from "@/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { logAuditAction } from "@/lib/audit";

export interface ThreadActionState {
  success: boolean;
  message: string;
  code: string;
}

// ... (Top imports remain the same, need to add Chat interface or use raw db)
import { Chat } from "@/types/chat";

export async function createThread(prevState: ThreadActionState, formData: FormData): Promise<ThreadActionState> {
  const session = await auth();
  if (!session?.user?.id) { 
    return { success: false, code: "AUTH_REQUIRED", message: "ログインが必要です。" };
  }

  // 0. Permission Check (Strict)
  const userRole = session.user.role;
  if (userRole !== "ROOT" && userRole !== "ADMIN" && userRole !== "TEACHER") {
      return { success: false, code: "FORBIDDEN", message: "スレッド作成権限がありません。" };
  }

  const validated = CreateThreadSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    hiddenFromGlobalTodo: formData.get("hiddenFromGlobalTodo") === "true",
  });

  if (!validated.success) {
      return { success: false, code: "VALIDATION_ERROR", message: "入力内容が正しくありません。" };
  }

  // Parse Members
  let selectedMembers: string[] = [];
  try {
      const membersJson = formData.get("members") as string;
      if (membersJson) {
          selectedMembers = JSON.parse(membersJson);
      }
  } catch (e) {
      console.warn("Failed to parse members JSON", e);
  }

  // Ensure Creator is member
  const allMembers = Array.from(new Set([...selectedMembers, session.user.id]));
  const memberDetails = allMembers.map(uid => ({
      uid,
      role: uid === session.user.id ? "owner" : "editor" 
  })) as any[];

  const threadRef = db.collection("threads").doc();
  const threadId = threadRef.id;

  const initialThread: Thread = {
    id: threadId,
    title: validated.data.title,
    description: validated.data.description || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: session.user.id,
    driveFolderId: "", 
    status: "pending", 
    members: allMembers, 
    memberDetails: memberDetails,
    hiddenFromGlobalTodo: validated.data.hiddenFromGlobalTodo ?? false,
  };

  try {
    // 1. Create Firestore Document (Pending)
    await threadRef.set(initialThread);

    // 2. Create Drive Folder & Grant Creator Access
    let driveFolderId = "";
    try {
        driveFolderId = await ensureThreadDriveStructure(threadId, validated.data.title, session.user.email!);
        
        // Grant access to other initial members
        if (selectedMembers.length > 0) {
            // Fetch emails for initial members
            const memberDocs = await Promise.all(selectedMembers.map(uid => db.collection("users").doc(uid).get()));
            const memberEmails = memberDocs.map(d => d.data()?.email).filter(Boolean) as string[];
            
            await Promise.all(memberEmails.map(email => 
                grantPermission(driveFolderId, email, "writer").catch(e => console.warn(`Failed to grant invitee access: ${email}`))
            ));
        }

    } catch (driveErr: any) {
         console.error("Drive Creation Failed:", driveErr);
         // Keep thread but warn? or Rollback?
         // Rollback safer for consistency
         await threadRef.delete();
         return { 
             success: false, 
             code: "DRIVE_CREATION_FAILED", 
             message: `Google Driveフォルダの作成に失敗しました: ${driveErr.message}` 
         };
    }

    // 4. Update Firestore with Drive ID
    await threadRef.update({
        driveFolderId: driveFolderId,
        status: "active",
        updatedAt: Date.now()
    });

    // 5. [NEW] Create Auto-Group Chat
    try {
        const chatRef = db.collection("chats").doc();
        const initialMessage = {
            id: crypto.randomUUID(),
            senderId: "system",
            content: `スレッド「${validated.data.title}」が作成されました。`,
            createdAt: Date.now(),
            readBy: []
        };

        const newChat: Chat = {
            id: chatRef.id,
            type: "group",
            name: validated.data.title, // Use thread title as group name
            participants: allMembers,
            updatedAt: Date.now(),
            lastMessage: initialMessage.content,
            threadId: threadId, // Link to thread if needed
            seenBy: []
        };

        await chatRef.set(newChat);
        // Add welcome message to subcollection
        await chatRef.collection("messages").doc(initialMessage.id).set(initialMessage);

    } catch (chatError) {
        console.error("Auto-Chat Creation Failed:", chatError);
        // Don't fail the thread creation for this
    }

    // 6. Audit Log for Thread Creation
    try {
        await logAuditAction("THREAD_CREATE", threadId, validated.data.title, {
            members: allMembers.length,
            createdBy: session.user.email
        });
    } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
    }

  } catch (error: any) {
    console.error("Thread Creation Error:", error);
    await threadRef.update({ status: "archived", updatedAt: Date.now() }); 
    return { 
        success: false, 
        code: "THREAD_SETUP_FAILED", 
        message: "スレッドの初期設定中にエラーが発生しました。" 
    };
  }

  revalidatePath("/dashboard"); 
  revalidatePath("/threads");
  revalidateTag('threads', 'max');
  redirect(`/thread/${threadId}`); 
}

// --- Thread Management Actions ---

export async function updateThreadSettings(
    threadId: string, 
    data: { hiddenFromGlobalTodo?: boolean }
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const threadRef = db.collection("threads").doc(threadId);
    const doc = await threadRef.get();
    if (!doc.exists) return { success: false, message: "Thread not found" };

    const threadData = doc.data() as Thread;
    const isOwner = threadData.createdBy === session.user.id;
    const isAdmin = session.user.role === "ROOT" || session.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
        return { success: false, message: "Forbidden" };
    }

    try {
        await threadRef.update({
            ...data,
            updatedAt: Date.now()
        });
        revalidatePath(`/thread/${threadId}`);
        revalidatePath("/todo"); // Update global todo page
        revalidateTag('threads', 'max');
        return { success: true };
    } catch (e) {
        console.error("Update Thread Settings Failed", e);
        return { success: false, message: "Failed to update settings" };
    }
}

export async function deleteThread(threadId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const threadRef = db.collection("threads").doc(threadId);
    const doc = await threadRef.get();
    
    if (!doc.exists) return { success: false, message: "Thread not found" };
    const data = doc.data() as Thread;

    // Permissions: Only ROOT or Creator
    const isRoot = session.user.role === "ROOT";
    const isCreator = data.createdBy === session.user.id;

    if (!isRoot && !isCreator) {
        return { success: false, message: "Forbidden" };
    }

    try {

import { deleteTaskPermanent } from "./task";

    try {
        // --- HARD DELETE ---

        // 1. Delete All Tasks (Cascade)
        // This handles task drive folder/file deletion as well
        const tasksSnap = await db.collection("tasks").where("threadId", "==", threadId).get();
        if (!tasksSnap.empty) {
            // Processing in parallel might be too heavy for many tasks, but sequential is safer for rate limits
            // Using Promise.all with small chunks or just all is usually fine for < 50 tasks.
            // Let's use Promise.all.
            await Promise.all(tasksSnap.docs.map(doc => deleteTaskPermanent(doc.id, threadId)));
        }

        // 2. Delete Thread Chat (Optional but clean)
        const chatsSnap = await db.collection("chats").where("threadId", "==", threadId).get();
        if (!chatsSnap.empty) {
            const batchChat = db.batch();
            for (const c of chatsSnap.docs) {
                // Delete messages subcollection? Firestore requires manual recursion or cloud functions.
                // For now, we delete the chat doc. The messages will be orphaned in DB but hidden.
                // A true hard delete of subcollections is expensive in client code.
                // Given the constraints, let's just delete the chat doc reference.
                batchChat.delete(c.ref);
            }
            await batchChat.commit();
        }

        // 3. Delete Thread Drive Folder
        if (data.driveFolderId) {
            try {
                await deleteFile(data.driveFolderId);
            } catch (e) {
                console.warn(`Failed to delete Thread Drive Folder: ${data.driveFolderId}`, e);
            }
        }

        // 4. Delete Thread Document
        await threadRef.delete();

        revalidatePath("/dashboard");
        revalidatePath("/threads");
        revalidatePath("/todo");
        revalidateTag('threads', 'max');
        revalidateTag('tasks', 'max');
        return { success: true };
    } catch (e) {
        console.error("Delete Thread Failed", e);
        return { success: false, message: "Failed to delete thread" };
    }
}

export async function addMembers(threadId: string, memberIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        await db.runTransaction(async (t) => {
            const threadRef = db.collection("threads").doc(threadId);
            const doc = await t.get(threadRef);
            if (!doc.exists) throw "Thread not found";
            
            const data = doc.data() as Thread;
            
            // Perms
            const isRoot = session.user.role === "ROOT";
            const isOwner = data.createdBy === session.user.id;
            const isAdmin = session.user.role === "ADMIN"; 

            if (!isRoot && !isOwner && !isAdmin) throw "Forbidden";

            const currentMembers = new Set(data.members);
            const currentDetails = data.memberDetails || [];

            memberIds.forEach(mid => {
                if (!currentMembers.has(mid)) {
                    currentMembers.add(mid);
                    currentDetails.push({ uid: mid, role: "viewer" }); // Default role
                }
            });

            t.update(threadRef, {
                members: Array.from(currentMembers),
                memberDetails: currentDetails,
                updatedAt: Date.now()
            });

            // Update Chat Participants if exists
            // Finding chat by threadId or fuzzy match
            // Ideally we store chatId in thread, but we didn't.
            // Search for Group Chat with type='group' and threadId? 
            // In createThread we added threadId to Chat.
             const chatsQuery = await db.collection("chats").where("threadId", "==", threadId).limit(1).get();
             if (!chatsQuery.empty) {
                 const chatRef = chatsQuery.docs[0].ref;
                 // Need to read chat to get current participants? 
                 // Simple merge:
                 const chatDoc = await t.get(chatRef);
                 const chatData = chatDoc.data() as Chat;
                 const newParticipants = Array.from(new Set([...chatData.participants, ...memberIds]));
                 
                 t.update(chatRef, { participants: newParticipants });
                 
                 // Add System Message
                 const sysMsgRef = chatRef.collection("messages").doc();
                 t.set(sysMsgRef, {
                     id: sysMsgRef.id,
                     senderId: "system",
                     content: "メンバーが追加されました。",
                     createdAt: Date.now(),
                     readBy: []
                 });
             }
            // Update Permissions (ACL)
            if (data.driveFolderId) {
                // Fetch emails
                const memberDocs = await Promise.all(memberIds.map(uid => db.collection("users").doc(uid).get()));
                const emails = memberDocs.map(d => d.data()?.email).filter(Boolean) as string[];
                
                // Grant access
                emails.forEach(email => {
                    grantPermission(data.driveFolderId!, email, "writer").catch(e => console.error("ACL Update Failed", e));
                });
            }

        });

        revalidatePath(`/thread/${threadId}`);
        revalidateTag('threads', 'max');
        return { success: true };
    } catch (e) {
        console.error("Add Members Failed", e);
        return { success: false, message: typeof e === 'string' ? e : "Failed to add members" };
    }
}

export async function removeMember(threadId: string, memberId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        await db.runTransaction(async (t) => {
            const threadRef = db.collection("threads").doc(threadId);
            const doc = await t.get(threadRef);
            if (!doc.exists) throw "Thread not found";
            
            const data = doc.data() as Thread; // Cast to Thread
             // Perms
            const isRoot = session.user.role === "ROOT";
            const isOwner = data.createdBy === session.user.id;
            
            // Can remove self? Yes.
            const isSelf = session.user.id === memberId;

            if (!isRoot && !isOwner && !isSelf) throw "Forbidden";
            
            // Cannot remove Owner
            if (data.createdBy === memberId) throw "Cannot remove owner";

            const newMembers = data.members.filter(m => m !== memberId);
            const newDetails = (data.memberDetails || []).filter(d => d.uid !== memberId);

            t.update(threadRef, {
                members: newMembers,
                memberDetails: newDetails,
                updatedAt: Date.now()
            });

             // Update Chat
             const chatsQuery = await db.collection("chats").where("threadId", "==", threadId).limit(1).get();
             if (!chatsQuery.empty) {
                 const chatRef = chatsQuery.docs[0].ref;
                 const chatDoc = await t.get(chatRef);
                 const chatData = chatDoc.data() as Chat;
                 
                 const newParticipants = chatData.participants.filter(p => p !== memberId);
                 t.update(chatRef, { participants: newParticipants });

                 const sysMsgRef = chatRef.collection("messages").doc();
                 t.set(sysMsgRef, {
                     id: sysMsgRef.id,
                     senderId: "system",
                     content: "メンバーが退出しました。",
                     createdAt: Date.now(),
                     readBy: []
                 });
             }
        });

        revalidatePath(`/thread/${threadId}`);
        revalidateTag('threads', 'max');
        return { success: true };
    } catch (e) {
        console.error("Remove Member Failed", e);
        return { success: false, message: typeof e === 'string' ? e : "Failed to remove member" };
    }
}


export async function getUploadSession(threadId: string, fileName: string, mimeType: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Verify user has access to this thread
    const threadDoc = await db.collection("threads").doc(threadId).get();
    if (!threadDoc.exists) throw new Error("Thread not found");
    const thread = threadDoc.data() as Thread;

    if (!thread.members.includes(session.user.id)) {
        throw new Error("Forbidden");
    }

    if (!thread.driveFolderId) throw new Error("Thread not fully initialized");

    // @ts-ignore
    const accessToken = session.accessToken as string;

    // Generate Resumable Upload URL
    // Use the Thread's "Task_Drafts" folder as parent for temporary uploads
    const draftFolderName = "Task_Drafts";
    const draftFolderId = await findOrCreateFolder(draftFolderName, thread.driveFolderId);

    const uploadUrl = await getResumableUploadUrl(fileName, mimeType, draftFolderId, accessToken);

    return uploadUrl;
}

export async function refreshThread(threadId: string) {
    revalidatePath(`/thread/${threadId}`);
}

/**
 * Cached function to get all active threads
 * Shared across all users for efficiency
 * Revalidates every 3 minutes or on tag invalidation
 */
const getCachedAllActiveThreads = unstable_cache(
    async () => {
        const snap = await db.collection("threads")
            .where("status", "==", "active")
            .get();
        return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Thread));
    },
    ['all_active_threads_cache'],
    { tags: ['threads'], revalidate: 180 }
);

export async function getThreads() {
    const session = await auth();
    if (!session?.user?.id) return [];

    // Get all threads from cache, then filter by user membership
    const allThreads = await getCachedAllActiveThreads();
    const items = allThreads.filter(t => t.members.includes(session.user!.id));
    
    // In-memory Sort (to avoid Composite Index requirement)
    items.sort((a, b) => b.updatedAt - a.updatedAt);

    return items;
}
