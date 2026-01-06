"use server";

import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";

export async function sendNewMessageNotification(
    chatId: string, 
    senderId: string, 
    content: string, 
    chatName?: string
) {
    if (!chatId || !senderId) return { success: false };

    try {
        // Fetch Chat to get participants
        const chatDoc = await db.collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return { success: false, message: "Chat not found" };

        const chatData = chatDoc.data();
        const participants = chatData?.participants || [];

        // Exclude sender
        const recipients = participants.filter((uid: string) => uid !== senderId);

        if (recipients.length === 0) return { success: true };

        // Determine Title
        // If DM, title is Sender Name. If Group, title is Group Name (or Sender @ Group)
        const senderDoc = await db.collection("users").doc(senderId).get();
        const senderName = senderDoc.data()?.nickname || "Unknown";

        let title = senderName;
        if (chatData?.type === 'group') {
            title = `${senderName} (in ${chatName || chatData.name || 'Group'})`;
        }

        // Truncate content
        const body = content.length > 50 ? content.substring(0, 50) + '...' : content;

        await sendPushNotification(
            recipients,
            title,
            body,
            `/messages?id=${chatId}`, // Deep link to chat
            `chat-${chatId}`,
            'newMessage'
        );

        return { success: true };
    } catch (e) {
        console.error("Failed to send message notification", e);
        return { success: false, error: e };
    }
}
