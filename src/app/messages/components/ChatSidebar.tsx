"use client";

import { Chat } from "@/types/chat";
import { useState, useEffect, useMemo } from "react";
import CreateGroupModal from "./CreateGroupModal";
import { useRouter } from "next/navigation";
import { useChatListUpdates } from "@/hooks/useRTDB";

interface ChatSidebarProps {
    users: any[];
    currentUser: any;
    chats: Chat[];
    selectedUserId: string | null;
    onSelectUser: (uid: string) => void;
}

// Format date/time nicely
function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
        return timeStr;
    } else if (isYesterday) {
        return `昨日 ${timeStr}`;
    } else {
        return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) + ' ' + timeStr;
    }
}

export default function ChatSidebar({ users, currentUser, chats: initialChats, selectedUserId, onSelectUser }: ChatSidebarProps) {
    const [search, setSearch] = useState("");
    const [showGroupModal, setShowGroupModal] = useState(false);
    const router = useRouter();
    
    // Get real-time updates for chat list
    const chatUpdates = useChatListUpdates(initialChats.map(c => c.id));
    
    // Merge initial chats with real-time updates
    const chats = useMemo(() => {
        return initialChats.map(chat => {
            const update = chatUpdates[chat.id];
            if (update) {
                return {
                    ...chat,
                    lastMessage: update.lastMessage || chat.lastMessage,
                    updatedAt: update.updatedAt || chat.updatedAt,
                    seenBy: update.seenBy || chat.seenBy
                };
            }
            return chat;
        });
    }, [initialChats, chatUpdates]);

    // Filter users
    const filteredUsers = users.filter(u => 
        u.id !== currentUser.id && 
        u.nickname !== "Unknown" && 
        u.name !== "Unknown" &&
        (u.nickname || u.name) &&
        (u.nickname || u.name).trim() !== "" &&
        (u.nickname || u.name || "").toLowerCase().includes(search.toLowerCase())
    );

    // Sort and filter group chats by most recent
    const groupChats = useMemo(() => {
        return chats
            .filter(c => c.type === 'group')
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [chats]);

    // Create sorted DM chats with user info
    const sortedDMs = useMemo(() => {
        return filteredUsers
            .map(user => {
                const chat = chats.find(c => c.type !== 'group' && c.participants.includes(user.id));
                return { user, chat };
            })
            .sort((a, b) => {
                // Users with chats come first, sorted by recency
                if (a.chat && b.chat) {
                    return (b.chat.updatedAt || 0) - (a.chat.updatedAt || 0);
                }
                if (a.chat) return -1;
                if (b.chat) return 1;
                return 0;
            });
    }, [filteredUsers, chats]);

    const handleGroupCreated = () => {
        router.refresh();
    };

    const navigateToChat = (chatId: string) => {
        router.push(`/messages?chatId=${chatId}`);
    };

    // Check if chat has unread messages
    const isUnread = (chat: Chat | undefined) => {
        if (!chat) return false;
        return !chat.seenBy?.includes(currentUser.id);
    };

    return (
        <div className="w-80 border-r border-white/10 flex flex-col bg-zinc-900/50 backdrop-blur-md">
            <div className="p-4 border-b border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">メッセージ</h2>
                    <button 
                        onClick={() => setShowGroupModal(true)}
                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors"
                    >
                        + グループ作成
                    </button>
                </div>
                <input 
                    type="text" 
                    placeholder="検索..." 
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-6">
                {/* Groups Section */}
                {groupChats.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-zinc-500 px-2 mb-2 uppercase tracking-wider">グループ</h3>
                        <div className="space-y-1">
                            {groupChats.map(chat => {
                                const unread = isUnread(chat);
                                return (
                                    <div 
                                        key={chat.id}
                                        onClick={() => navigateToChat(chat.id)}
                                        className={`p-2 flex items-center gap-3 cursor-pointer rounded-lg transition-colors relative ${
                                            unread ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        {/* Unread indicator dot */}
                                        {unread && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r" />
                                        )}
                                        
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                                            unread 
                                                ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50' 
                                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                        }`}>
                                            #
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h3 className={`font-medium truncate ${unread ? 'text-white' : 'text-zinc-200'}`}>
                                                    {chat.name}
                                                </h3>
                                                <span className={`text-xs ${unread ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                    {formatDateTime(chat.updatedAt)}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate ${unread ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}`}>
                                                {chat.lastMessage}
                                            </p>
                                        </div>
                                        
                                        {/* Unread badge */}
                                        {unread && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Direct Messages / People */}
                <div>
                     <h3 className="text-xs font-semibold text-zinc-500 px-2 mb-2 uppercase tracking-wider">メンバー</h3>
                     <div className="space-y-1">
                        {sortedDMs.map(({ user, chat }) => {
                            const isSelected = selectedUserId === user.id;
                            const unread = isUnread(chat);

                            return (
                                <div 
                                    key={user.id}
                                    onClick={() => onSelectUser(user.id)}
                                    className={`p-2 flex items-center gap-3 cursor-pointer rounded-lg transition-colors relative ${
                                        isSelected ? 'bg-white/10' : 
                                        unread ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-white/5'
                                    }`}
                                >
                                    {/* Unread indicator dot */}
                                    {unread && !isSelected && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r" />
                                    )}
                                    
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                        unread && !isSelected ? 'bg-indigo-500/20 text-indigo-200' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        {user.nickname?.[0] || user.name?.[0] || "?"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <h3 className={`font-medium truncate ${unread && !isSelected ? 'text-white' : 'text-zinc-200'}`}>
                                                {user.nickname || user.name || "Unknown"}
                                            </h3>
                                            {chat && (
                                                <span className={`text-xs ${unread ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                    {formatDateTime(chat.updatedAt)}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm truncate ${unread && !isSelected ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}`}>
                                            {chat?.lastMessage || "チャットを開始"}
                                        </p>
                                    </div>
                                    
                                    {/* Unread badge */}
                                    {unread && !isSelected && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {showGroupModal && (
                <CreateGroupModal 
                    users={users} 
                    onClose={() => setShowGroupModal(false)} 
                    onCreated={handleGroupCreated} 
                />
            )}
        </div>
    );
}
