import { useEffect, useState, useRef } from "react";
import { rtdb } from "@/lib/firebase_client";
import { ref, onValue, push, set, onDisconnect, query, limitToLast, orderByChild, serverTimestamp, get, remove } from "firebase/database";
import { Message } from "@/types/chat";

export function useChatMessages(chatId: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(20); // Default to 20 for resource optimization

    useEffect(() => {
        if (!chatId) return;

        setLoading(true);
        const messagesRef = query(
            ref(rtdb, `messages/${chatId}`),
            orderByChild("createdAt"),
            limitToLast(limit)
        );

        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgList = Object.entries(data).map(([key, val]: [string, any]) => ({
                    id: key,
                    ...val
                }));
                msgList.sort((a, b) => a.createdAt - b.createdAt);
                setMessages(msgList);
            } else {
                setMessages([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [chatId, limit]);

    const loadMore = () => {
        setLimit(prev => prev + 20);
    };

    const sendMessage = async (senderId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, replyTo?: { id: string, content: string, senderId: string }, attachments?: any[]) => {
        if (!chatId) throw new Error("No Chat ID");
        
        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const newMsgRef = push(messagesRef);
        
        const newMessage = {
            senderId,
            content,
            type,
            fileUrl: fileUrl || null,
            createdAt: serverTimestamp(), // Let Server determine time
            replyTo: replyTo || null,
            attachments: attachments || null,
        };

        await set(newMsgRef, newMessage);
        
        // Also update chat metadata for real-time sidebar updates
        const chatMetaRef = ref(rtdb, `chatMeta/${chatId}`);
        await set(chatMetaRef, {
            lastMessage: content.substring(0, 100), // Truncate for performance
            updatedAt: serverTimestamp(),
            seenBy: [senderId] // Sender has seen their own message
        });
        
        return newMsgRef.key;
    };

    return { messages, loading, sendMessage, loadMore, hasMore: messages.length >= limit };
}

/**
 * Hook to get real-time updates for chat list sidebar
 * Listens to chatMeta nodes in RTDB for live updates
 */
export function useChatListUpdates(chatIds: string[]) {
    const [updates, setUpdates] = useState<Record<string, { lastMessage?: string; updatedAt?: number; seenBy?: string[] }>>({});

    useEffect(() => {
        if (chatIds.length === 0) return;

        const unsubscribes: (() => void)[] = [];

        chatIds.forEach(chatId => {
            const metaRef = ref(rtdb, `chatMeta/${chatId}`);
            const unsub = onValue(metaRef, (snapshot) => {
                if (snapshot.exists()) {
                    setUpdates(prev => ({
                        ...prev,
                        [chatId]: snapshot.val()
                    }));
                }
            });
            unsubscribes.push(unsub);
        });

        return () => {
            unsubscribes.forEach(fn => fn());
        };
    }, [JSON.stringify(chatIds)]);

    return updates;
}

/**
 * Update seenBy in RTDB chatMeta for real-time sidebar updates
 * Called when user opens a chat to mark as read
 */
export async function markChatMetaAsSeen(chatId: string, userId: string) {
    if (!chatId || !userId) return;
    
    const metaRef = ref(rtdb, `chatMeta/${chatId}/seenBy`);
    
    try {
        // Get current seenBy array
        const snapshot = await get(metaRef);
        const currentSeenBy = snapshot.exists() ? (snapshot.val() as string[]) : [];
        
        // Add user if not already present
        if (!currentSeenBy.includes(userId)) {
            await set(metaRef, [...currentSeenBy, userId]);
        }
    } catch (e) {
        console.error("Failed to update chatMeta seenBy:", e);
    }
}

export function usePresence(userId: string, userInfo: { name: string, photoURL?: string }) {
    useEffect(() => {
        if (!userId) return;

        // Reference to specific user status
        const userStatusDatabaseRef = ref(rtdb, `status/${userId}`);
        const connectedRef = ref(rtdb, ".info/connected");

        const unsubscribe = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === false) {
                return;
            }

            // On disconnect, update status to offline
            onDisconnect(userStatusDatabaseRef).set({
                state: 'offline',
                lastChanged: serverTimestamp(),
                name: userInfo.name,
                photoURL: userInfo.photoURL || null
            }).then(() => {
                // Determine current status
                set(userStatusDatabaseRef, {
                    state: 'online',
                    lastChanged: serverTimestamp(),
                    name: userInfo.name,
                    photoURL: userInfo.photoURL || null
                });
            });
        });

        return () => unsubscribe();
    }, [userId, userInfo.name, userInfo.photoURL]);
}

export function useOnlineStatus(userIds: string[]) {
    const [statuses, setStatuses] = useState<Record<string, 'online' | 'offline'>>({});

    useEffect(() => {
        if (userIds.length === 0) return;

        const unsubscribes: (() => void)[] = [];

        userIds.forEach(uid => {
            const statusRef = ref(rtdb, `status/${uid}`);
            const unsub = onValue(statusRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setStatuses(prev => ({ ...prev, [uid]: data.state }));
                } else {
                    setStatuses(prev => ({ ...prev, [uid]: 'offline' }));
                }
            });
            unsubscribes.push(unsub);
        });

        return () => {
             unsubscribes.forEach(fn => fn());
        };
    }, [JSON.stringify(userIds)]);

    return statuses;
}

// --- New Features Hooks ---

export function useTyping(chatId: string, userId: string) {
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    
    useEffect(() => {
        if (!chatId) return;
        const typingRef = ref(rtdb, `typing/${chatId}`);
        const unsub = onValue(typingRef, (snapshot) => {
             const data = snapshot.val();
             if (data) {
                 const typers = Object.keys(data).filter(uid => uid !== userId && data[uid] === true);
                 setTypingUsers(typers);
             } else {
                 setTypingUsers([]);
             }
        });
        return () => unsub();
    }, [chatId, userId]);

    const setSelfTyping = (isTyping: boolean) => {
        if (!chatId || !userId) return;
        const myTypingRef = ref(rtdb, `typing/${chatId}/${userId}`);
        if (isTyping) {
            set(myTypingRef, true);
        } else {
            remove(myTypingRef);
        }
    };
    
    return { typingUsers, setSelfTyping };
}

export function useChatReadStatus(chatId: string) {
    const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!chatId) return;
        const lastSeenRef = ref(rtdb, `lastSeen/${chatId}`);
        const unsub = onValue(lastSeenRef, (snap) => {
            if (snap.exists()) {
                setLastSeenMap(snap.val());
            }
        });
        return () => unsub();
    }, [chatId]);

    const updateLastSeen = (userId: string) => {
         if (!chatId || !userId) return;
         set(ref(rtdb, `lastSeen/${chatId}/${userId}`), serverTimestamp());
    };

    return { lastSeenMap, updateLastSeen };
}

export async function sendReaction(chatId: string, messageId: string, userId: string, emoji: string) {
    const reactionRef = ref(rtdb, `messages/${chatId}/${messageId}/reactions/${userId}`);
    const snapshot = await get(reactionRef);
    if (snapshot.exists() && snapshot.val() === emoji) {
        await remove(reactionRef); // Toggle off
    } else {
        await set(reactionRef, emoji); // Set new
    }
}

