"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ChatSidebar from "./components/ChatSidebar";
import ChatWindow from "./components/ChatWindow";
import { Chat } from "@/types/chat";

interface MessagesClientProps {
    users: any[];
    currentUser: any;
    chats: Chat[];
    selectedUserId: string | null;
    selectedUser: any | null;
    chatId: string;
    initialMessages: any[];
    chatName?: string;
    isGroup?: boolean;
    participants?: string[];
}

export default function MessagesLayout({ 
    users, 
    currentUser, 
    chats, 
    selectedUserId, 
    selectedUser,
    chatId,
    initialMessages,
    chatName,
    isGroup,
    participants
}: MessagesClientProps) {
    const router = useRouter();

    const handleSelectUser = (uid: string) => {
        router.push(`/messages?uid=${uid}`);
    };

    // Derived active chat or user being viewed
    const showWindow = !!chatId; // If we have a chatId, we show window (even if empty)

    // Mobile Detection
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) {
        return (
             <div className="w-full h-full">
                {showWindow ? (
                     <ChatWindow 
                        key={chatId}
                        currentUser={currentUser}
                        recipientUser={selectedUser}
                        chatId={chatId}
                        initialMessages={initialMessages}
                        chatName={chatName}
                        isGroup={isGroup}
                        users={users}
                        participants={participants}
                        isMobile={true}
                        onBack={() => router.push('/messages')}
                    />
                ) : (
                    <ChatSidebar 
                        users={users} 
                        currentUser={currentUser} 
                        chats={chats} 
                        selectedUserId={selectedUserId} 
                        onSelectUser={handleSelectUser} 
                    />
                )}
             </div>
        );
    }

    return (
        <div className="flex w-full h-full">
            <ChatSidebar 
                users={users} 
                currentUser={currentUser} 
                chats={chats} 
                selectedUserId={selectedUserId} 
                onSelectUser={handleSelectUser} 
            />
            
            <div className="flex-1 h-full min-w-0">
                {showWindow ? (
                    <ChatWindow 
                        key={chatId} // Force re-mount on chat change to reset state cleanly
                        currentUser={currentUser}
                        recipientUser={selectedUser} // May be null for groups
                        chatId={chatId}
                        initialMessages={initialMessages}
                        chatName={chatName}
                        isGroup={isGroup}
                        users={users}
                        participants={participants}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/50">
                        <div className="text-4xl mb-4">💬</div>
                        <p>Select a user or group to start messaging</p>
                    </div>
                )}
            </div>
        </div>
    );
}

