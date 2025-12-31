"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { Chat, Message } from "@/types/chat";
import { FieldValue } from "firebase-admin/firestore";
import { logAuditAction } from "@/lib/audit";

// Helper to generate consistent Chat ID
const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join("_");
};

export async function createGroup(name: string, participantIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Permission Check: Only ADMIN, TEACHER, ROOT can create groups
    const userRole = session.user.role;
    if (userRole !== "ROOT" && userRole !== "ADMIN" && userRole !== "TEACHER") {
        throw new Error("グループ作成権限がありません。ADMIN以上の権限が必要です。");
    }

    // Add self to participants if not included
    const allParticipants = Array.from(new Set([...participantIds, session.user.id]));
    
    const newChatRef = db.collection("chats").doc();
    await newChatRef.set({
        type: 'group',
        name,
        participants: allParticipants,
        createdAt: Date.now(),
        lastMessage: "Group created",
        updatedAt: Date.now(),
        seenBy: [session.user.id]
    });

    // Audit Log for Group Creation
    try {
        await logAuditAction("GROUP_CREATE", newChatRef.id, name, {
            participants: allParticipants.length,
            createdBy: session.user.email
        });
    } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
    }

    return { success: true, chatId: newChatRef.id };
}

export async function addMembersToGroup(chatId: string, newParticipantIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) throw new Error("Chat not found");
    const data = chatDoc.data();
    if (data?.type !== 'group') throw new Error("Not a group chat");

    // SECURITY: Only existing participants or admins can add members
    const currentParticipants = data.participants || [];
    const isParticipant = currentParticipants.includes(session.user.id);
    const userRole = session.user.role;
    const isAdminOrHigher = userRole === "ROOT" || userRole === "ADMIN" || userRole === "TEACHER";
    
    if (!isParticipant && !isAdminOrHigher) {
        throw new Error("You must be a participant to add members");
    }

    // Add new members, ensuring uniqueness
    const updatedParticipants = Array.from(new Set([...currentParticipants, ...newParticipantIds]));

    await chatRef.update({
        participants: updatedParticipants,
        updatedAt: Date.now()
    });

    // Notify/System message?
    await chatRef.collection("messages").add({
        senderId: 'SYSTEM',
        content: `${newParticipantIds.length} members added.`,
        createdAt: Date.now()
    });

    return { success: true };
}

export async function leaveGroup(chatId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const uid = session.user.id;

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) throw new Error("Chat not found");
    const data = chatDoc.data();
    if (data?.type !== 'group') throw new Error("Not a group chat");

    const participants = data.participants || [];
    const updatedParticipants = participants.filter((p: string) => p !== uid);

    if (updatedParticipants.length === 0) {
        // Delete group if empty? Or keep it archived? 
        // For now, let's delete it to clean up.
        await chatRef.delete(); 
        // Note: Subcollection messages technically remain but are orphaned. 
        // Firestore requires recursive delete, but for simple MVP this effectively hides it.
    } else {
        await chatRef.update({
            participants: updatedParticipants,
            updatedAt: Date.now()
        });
        
        await chatRef.collection("messages").add({
            senderId: 'SYSTEM',
            content: `A member left the group.`,
            createdAt: Date.now()
        });
    }

    return { success: true };
}

export async function updateGroup(chatId: string, name: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) throw new Error("Chat not found");
    const data = chatDoc.data();
    
    // SECURITY: Only participants or admins can update group name
    const participants = data?.participants || [];
    const isParticipant = participants.includes(session.user.id);
    const userRole = session.user.role;
    const isAdminOrHigher = userRole === "ROOT" || userRole === "ADMIN" || userRole === "TEACHER";
    
    if (!isParticipant && !isAdminOrHigher) {
        throw new Error("You must be a participant to update group settings");
    }

    await chatRef.update({
        name,
        updatedAt: Date.now()
    });
    
    return { success: true };
}

// Update Metadata (Last Message, Timestamp) ONLY. Message content is in RTDB.
export async function updateChatMetadata(chatId: string, lastMessageContent: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    const senderId = session.user.id;
    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
        // Lazy create DM if it doesn't exist
        if (chatId.includes("_")) {
            const participants = chatId.split("_");
            if (participants.length === 2 && participants.includes(senderId)) {
                 await chatRef.set({
                    type: 'dm',
                    participants: participants,
                    createdAt: Date.now(),
                    lastMessage: lastMessageContent,
                    updatedAt: Date.now(),
                    seenBy: [senderId]
                });
                return { success: true, chatId };
            }
        }
        throw new Error("Chat not found");
    }

    await chatRef.update({
        lastMessage: lastMessageContent,
        updatedAt: Date.now(),
        seenBy: [senderId]
    });

    return { success: true };
}

export async function markAsSeen(chatId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) return { success: false };

    // SECURITY: Only participants can mark as seen
    const data = chatDoc.data();
    const participants = data?.participants || [];
    if (!participants.includes(session.user.id)) {
        return { success: false, message: "Not a participant" };
    }

    // Use arrayUnion to add self
    await chatRef.update({
        seenBy: FieldValue.arrayUnion(session.user.id)
    });
    
    return { success: true, userId: session.user.id };
}

// Helper to get Chat ID for DMs (Client can also generate this, but useful)
export async function getDmId(recipientId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return getChatId(session.user.id, recipientId);
}

// RESTORED: Fetch User Chats for Sidebar
export async function getUserChats() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const snapshot = await db.collection("chats")
        .where("participants", "array-contains", session.user.id)
        .get();

    const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Chat));

    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Kick a member from group - ADMIN, TEACHER, ROOT only
 */
export async function kickMember(chatId: string, targetUserId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    // Check executor role
    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;
    
    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        return { success: false, message: "ADMIN以上の権限が必要です" };
    }

    // Cannot kick yourself (use leaveGroup instead)
    if (targetUserId === session.user.id) {
        return { success: false, message: "自分自身をキックすることはできません" };
    }

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) return { success: false, message: "Chat not found" };
    const data = chatDoc.data();
    if (data?.type !== 'group') return { success: false, message: "Not a group chat" };

    const participants = data.participants || [];
    const updatedParticipants = participants.filter((p: string) => p !== targetUserId);

    await chatRef.update({
        participants: updatedParticipants,
        updatedAt: Date.now()
    });

    // System message
    const targetDoc = await db.collection("users").doc(targetUserId).get();
    const targetName = targetDoc.data()?.nickname || "メンバー";
    
    await chatRef.collection("messages").add({
        senderId: 'SYSTEM',
        content: `${targetName} がグループから削除されました`,
        createdAt: Date.now()
    });

    return { success: true };
}

/**
 * Delete entire group - ADMIN, TEACHER, ROOT only
 */
export async function deleteGroup(chatId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    // Check executor role
    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;
    
    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        return { success: false, message: "ADMIN以上の権限が必要です" };
    }

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) return { success: false, message: "Chat not found" };
    const data = chatDoc.data();
    if (data?.type !== 'group') return { success: false, message: "Not a group chat" };

    // Delete the chat document
    // Note: Subcollection messages will be orphaned but not accessible
    await chatRef.delete();

    return { success: true };
}
