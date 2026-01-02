"use client";

import { Message } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { updateChatMetadata, markAsSeen } from "@/app/actions/chat";
import UnifiedHeader from "@/components/UnifiedHeader";
import GroupSettingsModal from "./GroupSettingsModal";
import { useChatMessages, usePresence, useOnlineStatus, useTyping, useChatReadStatus, sendReaction, markChatMetaAsSeen } from "@/hooks/useRTDB";
import { Settings, ArrowDown, RotateCcw, Send, FileText, Folder, Reply, Link as LinkIcon } from "lucide-react";
import AttachmentButton from "./AttachmentButton";
import DrivePickerModal from "./DrivePickerModal";
import { shareDriveFilesToChat } from "@/app/actions/chat_drive";

interface ChatWindowProps {
    currentUser: any;
    recipientUser?: any;
    chatId: string;
    initialMessages: Message[];
    chatName?: string;
    isGroup?: boolean;
    users?: any[];
    participants?: string[];
    isMobile?: boolean;
    onBack?: () => void;
    threadId?: string;
}

export default function ChatWindow({ currentUser, recipientUser, chatId, initialMessages, chatName, isGroup, users = [], participants = [], isMobile = false, onBack, threadId }: ChatWindowProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [returnToMessageId, setReturnToMessageId] = useState<string | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    
    
    // Drive Picker State
    const [showDrivePicker, setShowDrivePicker] = useState(false);
    
    // Timer refs
    const returnButtonTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { messages, loading, sendMessage, loadMore } = useChatMessages(chatId);
    const { typingUsers, setSelfTyping } = useTyping(chatId, currentUser.id);
    const { lastSeenMap, updateLastSeen } = useChatReadStatus(chatId);
    
    usePresence(currentUser.id, {
        name: currentUser.nickname || currentUser.name,
        photoURL: currentUser.image
    });

    const monitoredIds = isGroup 
        ? (participants.filter(pid => pid !== currentUser.id)) 
        : (recipientUser ? [recipientUser.id] : []);
    const onlineStatuses = useOnlineStatus(monitoredIds);

    // Auto-scroll logic
    useEffect(() => {
        if (!highlightedMessageId && !returnToMessageId && messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, typingUsers]); 

    // Read Logic - Update BOTH Firestore and RTDB chatMeta
    useEffect(() => {
         if (messages.length > 0) {
             markAsSeen(chatId).catch(console.error);
             markChatMetaAsSeen(chatId, currentUser.id); // Sync to RTDB for real-time sidebar
             updateLastSeen(currentUser.id);
         }
    }, [messages.length, chatId, currentUser.id]);

    // Button Auto-Hide Logic
    useEffect(() => {
        if (returnToMessageId) {
            if (returnButtonTimerRef.current) clearTimeout(returnButtonTimerRef.current);
            returnButtonTimerRef.current = setTimeout(() => {
                setReturnToMessageId(null); // Hide after 5s
            }, 5000);
        }
        return () => {
             if (returnButtonTimerRef.current) clearTimeout(returnButtonTimerRef.current);
        };
    }, [returnToMessageId]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 600;
        const isAtTop = scrollTop < 50; // Check if at the very top
        setShowScrollBottom(!isNearBottom && !isAtTop); // Hide if near bottom OR at top
    };

    const scrollToMessage = (targetId: string, returnId?: string) => {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(targetId);
            setTimeout(() => setHighlightedMessageId(null), 1000); // 1.0s Highlight (Shortened)
            
            if (returnId) {
                setReturnToMessageId(returnId);
            }
        }
    };

    const handleReturnToOriginal = () => {
        if (returnToMessageId) {
            scrollToMessage(returnToMessageId);
            setReturnToMessageId(null);
        } else {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    // Unified Attachment Handler
    const handleAttachmentsAdd = async (attachments: any[]) => {
        try {
            updateLastSeen(currentUser.id);
            const type = attachments.length > 0 ? 'file' : 'text'; 
            const content = inputValue.trim() || `Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}`;
            
            // Sanitize attachments to remove undefined values (RTDB doesn't support undefined)
            const sanitizedAttachments = attachments.map(att => ({
                id: att.id || null,
                name: att.name || "Untitled",
                url: att.url || null,
                type: att.type || "application/octet-stream",
                size: att.size || 0,
                driveId: att.driveId || null,
                thumbnailLink: att.thumbnailLink || null
            }));

            await sendMessage(
                currentUser.id, 
                content, 
                type, 
                undefined, // fileUrl (legacy single file)
                undefined, // replyTo
                sanitizedAttachments
            );
            
            setInputValue("");
            setReturnToMessageId(null);
            updateChatMetadata(chatId, `Sent ${attachments.length} file(s)`).catch(console.error);
        } catch (error) {
            console.error("Failed to send attachments", error);
            alert("Failed to send files");
        }
    };

    // Handle Drive Selection
    const handleDriveFilesSelected = async (selectedFiles: any[]) => {
        try {
            // Use gcsPath (Google Drive ID) if available, otherwise fallback to id (legacy)
            // The Server Action expects Google Drive File IDs, not Firestore IDs.
            const fileIds = selectedFiles.map(f => f.gcsPath).filter(Boolean);
            
            if (fileIds.length === 0) {
                if (selectedFiles.length > 0) alert("選択されたファイルにDrive IDが含まれていません");
                return;
            }

            const attachments = await shareDriveFilesToChat(
                chatId,
                chatName || "Chat",
                participants.length > 0 ? participants : [currentUser.id, recipientUser?.id].filter(Boolean),
                fileIds
            );
            
            if (attachments.length > 0) {
                await handleAttachmentsAdd(attachments);
            }
        } catch (e: any) {
            console.error("Failed to share drive files", e);
            alert(`共有に失敗しました: ${e.message || e}`);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const content = inputValue;
        const replyToData = replyingTo ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderId: replyingTo.senderId
        } : undefined;

        setInputValue(""); 
        setReplyingTo(null);
        setSelfTyping(false);
        setReturnToMessageId(null);

        try {
            updateLastSeen(currentUser.id);
            await sendMessage(currentUser.id, content, 'text', undefined, replyToData);
            updateChatMetadata(chatId, content).catch(err => console.error("Metadata update failed", err));
        } catch (error) {
            console.error("Failed to send", error);
            setInputValue(content);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setSelfTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setSelfTyping(false), 3000);
    };

    const getSenderName = (uid: string) => {
        if (uid === currentUser.id) return "You";
        const user = users.find(u => u.id === uid);
        return user?.nickname || user?.name || "Unknown";
    };

    const getReadInfo = (msg: Message) => {
        if (!isGroup) {
             const otherId = recipientUser?.id;
             if (!otherId || !lastSeenMap[otherId]) return { text: "送信済み", count: 0, readers: [] };
             if (lastSeenMap[otherId] >= msg.createdAt) return { text: "既読", count: 1, readers: [recipientUser.nickname || recipientUser.name || "Recipient"] };
             return { text: "送信済み", count: 0, readers: [] };
        } else {
            const readers = monitoredIds.filter(uid => (lastSeenMap[uid] || 0) >= msg.createdAt);
            const count = readers.length;
            let statusText = "送信済み";
            if (count === monitoredIds.length && count > 0) statusText = "全員既読";
            else if (count > 0) statusText = `${count}人 既読`;

            return { text: statusText, count, readers: readers.map(uid => getSenderName(uid)) };
        }
    };

    const headerTitle = isGroup ? chatName : (recipientUser?.nickname || recipientUser?.name || "Unknown");
    const headerSubtitle = isGroup 
        ? `${participants.length} 人のメンバー` 
        : (onlineStatuses[recipientUser?.id || ''] === 'online' ? '🟢 オンライン' : (recipientUser?.jobTitle || "オフライン"));

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 relative overflow-hidden"> 
            
            {/* Header */}
            <UnifiedHeader
                user={currentUser}
                title={
                    <div className="flex items-center gap-3">
                        {isMobile && onBack && (
                            <button onClick={onBack} className="bg-white/10 p-2 rounded-full mr-1 hover:bg-white/20 transition-colors">
                                <ArrowDown className="w-5 h-5 rotate-90 text-white" />
                            </button>
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold relative ${isGroup ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-600'}`}>
                            {isGroup ? '#' : (recipientUser?.nickname?.[0] || recipientUser?.name?.[0] || "?")}
                            {!isGroup && onlineStatuses[recipientUser?.id || ''] === 'online' && (
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>
                            )}
                        </div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">{headerTitle}</h3>
                        
                        {/* V12.5: Inverse Link to Thread */}
                        {isGroup && threadId && (
                            <a 
                                href={`/thread/${threadId}`}
                                className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
                            >
                                <LinkIcon size={10} />
                                <span>スレッドへ</span>
                            </a>
                        )}
                    </div>
                }
                subtitle={
                    <span className={headerSubtitle.includes('オンライン') ? 'text-green-400 font-bold' : 'text-zinc-400'}>
                        {headerSubtitle}
                    </span>
                }
                className="px-4 py-3 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md z-20 relative mb-0"
            >
                {isGroup && (currentUser.role === 'ADMIN' || currentUser.role === 'ROOT' || currentUser.role === 'TEACHER') && (
                    <button 
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                )}
            </UnifiedHeader>

            {/* Scroll/Return Button - MOVED TO TOP CENTER (Below Header) */}
            {(showScrollBottom || returnToMessageId) && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                     <button 
                        onClick={returnToMessageId ? handleReturnToOriginal : () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="bg-zinc-800/90 hover:bg-indigo-600 border border-white/10 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-4 duration-300 font-bold text-sm pointer-events-auto backdrop-blur-md"
                    >
                        {returnToMessageId ? (
                            <>
                                <RotateCcw className="w-4 h-4" />
                                <span>元の位置に戻る</span>
                            </>
                        ) : (
                            <>
                                <ArrowDown className="w-4 h-4" />
                                <span>最新</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
                onScroll={handleScroll}
            >
                {/* Load More Button */}
                {messages.length >= 20 && (
                    <div className="flex justify-center">
                         <button 
                            onClick={loadMore}
                            className="text-xs text-zinc-500 hover:text-indigo-400 py-2"
                         >
                            過去のメッセージを読み込む
                         </button>
                    </div>
                )}

                {loading && messages.length === 0 && (
                    <div className="flex justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-500"></div>
                    </div>
                )}
                
                {messages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.id;
                    const showDate = idx === 0 || (msg.createdAt - messages[idx - 1]?.createdAt > 1000 * 60 * 60);
                    const showSender = isGroup && !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                    const readInfo = isMe ? getReadInfo(msg) : null;
                    const isHighlighted = highlightedMessageId === msg.id;

                    return (
                        <div 
                            key={msg.id} 
                            id={`msg-${msg.id}`}
                            className="group/msg relative"
                        >
                            {showDate && (
                                <div className="text-center text-xs text-zinc-600 my-4">
                                    {new Date(msg.createdAt).toLocaleString()}
                                </div>
                            )}
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {showSender && (
                                    <span className="text-[10px] text-zinc-400 mb-1 ml-2">{getSenderName(msg.senderId)}</span>
                                )}
                                
                                <div className={`relative max-w-[85%] md:max-w-[65%] w-fit transition-all duration-300 ${isHighlighted ? 'z-10' : ''}`}>
                                    
                                    {/* Hover Menu - Repositioned: Absolute Above Bubble */}
                                    <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-0.5 bg-zinc-900/90 border border-white/10 rounded-full px-1 py-1 shadow-lg z-20 backdrop-blur-sm`}>
                                        <button 
                                            onClick={() => {
                                                setReplyingTo(msg);
                                                inputRef.current?.focus();
                                            }}
                                            className="hover:bg-white/10 p-1.5 rounded-full text-base leading-none"
                                            title="返信"
                                        >
                                            <Reply className="w-4 h-4 text-zinc-400" />
                                        </button>
                                        <div className="w-[1px] bg-white/10 mx-0.5"></div>
                                        {['👍', '❤️', '🤷‍♂️'].map(emoji => (
                                            <button 
                                                key={emoji}
                                                onClick={() => sendReaction(chatId, msg.id, currentUser.id, emoji)}
                                                className="hover:bg-white/10 p-1.5 rounded-full text-base leading-none"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>

                                    <div className={`px-4 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                                        isMe 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/5'
                                    } ${
                                        isHighlighted 
                                        ? 'ring-2 ring-indigo-400 shadow-[0_0_35px_rgba(129,140,248,0.9)] z-10 transition-all duration-300' 
                                        : 'transition-all duration-1000'
                                    }`}>
                                        
                                        {/* Reply Quote Block */}
                                        {msg.replyTo && (
                                            <div 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    scrollToMessage(msg.replyTo!.id, msg.id); 
                                                }}
                                                className="mb-2 pl-2 border-l-2 border-white/30 cursor-pointer hover:bg-white/5 rounded-r p-1 transition-colors select-none"
                                            >
                                                <div className="text-[10px] font-bold opacity-90 flex items-center gap-1">
                                                    <span>↩ {getSenderName(msg.replyTo.senderId)}</span>
                                                </div>
                                                <div className="text-xs opacity-70">
                                                    {msg.replyTo.content.length > 20 
                                                        ? msg.replyTo.content.substring(0, 20) + '...' 
                                                        : msg.replyTo.content}
                                                </div>
                                            </div>
                                        )}

                                        {/* Attachments Rendering */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="mb-2 flex flex-col gap-2">
                                                {msg.attachments.map((att, idx) => {
                                                     const isImage = att.type?.startsWith('image/');
                                                     const previewUrl = att.thumbnailLink || att.url; // Prefer thumbnail for preview
                                                     const viewUrl = att.url || att.webViewLink;

                                                     if (isImage && previewUrl) {
                                                         return (
                                                             <div key={idx} className="cursor-pointer group relative overflow-hidden rounded-lg border border-white/10" onClick={() => window.open(viewUrl, '_blank')}>
                                                                 <img 
                                                                    src={previewUrl} 
                                                                    alt={att.name} 
                                                                    className="max-w-[300px] w-full h-auto object-cover rounded-lg group-hover:scale-105 transition-transform duration-300" 
                                                                    referrerPolicy="no-referrer"
                                                                 />
                                                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                     {/* Could add size/name overlay on hover */}
                                                                 </div>
                                                             </div>
                                                         );
                                                     }

                                                     return (
                                                        <a 
                                                            key={idx} 
                                                            href={viewUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 p-2 bg-black/20 rounded hover:bg-black/30 transition-colors border border-white/5"
                                                        >
                                                            <span className="text-xl">
                                                                {att.type?.includes('pdf') ? <FileText className="w-5 h-5 text-red-400"/> : <Folder className="w-5 h-5 text-blue-400"/>}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-bold truncate max-w-[150px]">{att.name}</div>
                                                                <div className="text-[10px] opacity-70">{(att.size ? (att.size / 1024 / 1024).toFixed(2) : '?')} MB</div>
                                                            </div>
                                                        </a>
                                                     );
                                                })}
                                            </div>
                                        )}

                                        {msg.content}
                                    </div>
                                    
                                    {/* Reactions */}
                                    {(msg.reactions || Object.keys(msg.reactions || {}).length > 0) && (
                                        <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {Object.entries(msg.reactions || {}).map(([uid, emoji]) => (
                                                <button 
                                                    key={uid} 
                                                    onClick={() => sendReaction(chatId, msg.id, currentUser.id, emoji as string)}
                                                    className={`text-xs px-1.5 py-0.5 rounded-full border border-white/10 ${uid === currentUser.id ? 'bg-indigo-500/30 border-indigo-500/50' : 'bg-zinc-800'}`}
                                                    title={getSenderName(uid)}
                                                >
                                                    {emoji as React.ReactNode}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-1 mt-1 mr-1">
                                    <span className="text-[10px] text-zinc-500">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isMe && readInfo && (
                                        <span 
                                            className={`text-[10px] cursor-help ${readInfo.count > 0 ? 'text-indigo-400' : 'text-zinc-500'}`}
                                            title={
                                                (isGroup && currentUser.role === 'ROOT' && readInfo.readers.length > 0)
                                                    ? `既読: ${readInfo.readers.join(', ')}`
                                                    : undefined
                                            }
                                        >
                                            {!isGroup ? (readInfo.text === 'Read' ? '✓✓' : '✓') : readInfo.text}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Typing */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 px-4 animate-pulse">
                         <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                         </div>
                         {typingUsers.map(uid => getSenderName(uid)).join(", ")} が入力中...
                    </div>
                )}
                
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/10 bg-zinc-900/50 backdrop-blur-md">
                {/* Reply Banner */}
                {replyingTo && (
                    <div className="px-4 py-2 flex items-center justify-between border-b border-white/5 bg-zinc-800/50">
                        <div className="text-xs text-zinc-300 flex items-center gap-2 overflow-hidden">
                            <span className="text-zinc-500 whitespace-nowrap">返信先:</span>
                            <span className="font-bold whitespace-nowrap">{getSenderName(replyingTo.senderId)}</span>
                            <div className="truncate opacity-70 flex-1">
                                {replyingTo.content.length > 30 ? replyingTo.content.substring(0, 30) + '...' : replyingTo.content}
                            </div>
                        </div>
                        <button 
                            onClick={() => setReplyingTo(null)}
                            className="text-zinc-500 hover:text-white p-1"
                        >
                            ✕
                        </button>
                    </div>
                )}
                
                <form onSubmit={handleSend} className="p-4">
                    <div className="flex gap-2 items-end">
                        <AttachmentButton 
                            chatId={chatId}
                            groupName={chatName || "Chat"}
                            participants={participants.length > 0 ? participants : [currentUser.id, recipientUser?.id].filter(Boolean)}
                            onAttachmentsAdd={handleAttachmentsAdd}
                            onDriveClick={() => setShowDrivePicker(true)}
                        />

                        <div className="flex-1 bg-zinc-800 border border-white/10 rounded-3xl px-4 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                             <input 
                                ref={inputRef}
                                className="flex-1 bg-transparent border-none focus:outline-none text-zinc-100 placeholder-zinc-500"
                                placeholder={`${isGroup ? "グループ" : headerTitle}にメッセージを送信...`}
                                value={inputValue}
                                onChange={handleInputChange}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={!inputValue.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </button>
                    </div>
                </form>
            </div>

            {showSettings && isGroup && (
                <GroupSettingsModal 
                    users={users}
                    chatId={chatId}
                    currentName={chatName || "Group Chat"}
                    currentParticipants={participants}
                    onClose={() => setShowSettings(false)}
                    threadId={threadId}
                />
            )}

            {/* Drive Picker Modal - Top Level */}
            {showDrivePicker && (
                <DrivePickerModal 
                    onClose={() => setShowDrivePicker(false)}
                    onSelect={handleDriveFilesSelected}
                />
            )}
        </div>
    );
}
