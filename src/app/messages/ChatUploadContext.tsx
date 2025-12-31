"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { prepareChatUpload } from "@/app/actions/chat_drive";
import { prepareTaskUpload } from "@/app/actions/task_drive";
import { getUploadSession } from "@/app/actions/thread";
import { uploadChunk } from "@/app/actions/drive_upload";

// Constants
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

export interface ChatUploadItem {
    id: string;
    file: File;
    name: string;
    // Chat Context
    chatId?: string;
    groupName?: string;
    participants?: string[];
    // Task Context
    taskId?: string;
    threadId?: string;
    
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
    error?: string;
    result?: any; // The uploaded file result
}

interface ChatUploadContextType {
    uploads: ChatUploadItem[];
    uploadFile: (
        file: File,
        context: {
            chatId?: string,
            groupName?: string,
            participants?: string[],
            taskId?: string,
            threadId?: string
        },
        onSuccess: (attachment: any) => void
    ) => void;
    clearCompleted: () => void;
    cancelUpload: (id: string) => void;
    isManagerOpen: boolean;
    toggleManager: () => void;
    activeCount: number;
}

const ChatUploadContext = createContext<ChatUploadContextType | undefined>(undefined);

export function ChatUploadProvider({ children }: { children: ReactNode }) {
    const [uploads, setUploads] = useState<ChatUploadItem[]>([]);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const abortControllers = React.useRef<Map<string, AbortController>>(new Map());

    const activeCount = uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length;

    // Auto-close manager after 3s of no active uploads
    useEffect(() => {
        if (activeCount === 0 && uploads.length > 0) {
            const timer = setTimeout(() => {
                setUploads(prev => prev.filter(u => u.status !== 'completed'));
                if (uploads.every(u => u.status === 'completed')) {
                    setIsManagerOpen(false);
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [activeCount, uploads]);

    const updateUpload = (id: string, updates: Partial<ChatUploadItem>) => {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    };

    const processUpload = async (
        item: ChatUploadItem, 
        onSuccess: (attachment: any) => void
    ) => {
        // Create AbortController
        const controller = new AbortController();
        abortControllers.current.set(item.id, controller);

        updateUpload(item.id, { status: 'uploading', error: undefined, progress: 0 });
        const { file, chatId, groupName, participants, taskId, threadId } = item;

        try {
            // 1. Prepare
            let uploadUrl: string | null | undefined;
            
            if (taskId && threadId) {
                // Task Upload (Task already exists)
                const res = await prepareTaskUpload(
                    taskId,
                    threadId,
                    file.name,
                    file.type,
                    file.size
                );
                uploadUrl = res.uploadUrl;
            } else if (threadId && !taskId) {
                // Thread-level Upload (For new tasks or thread files)
                uploadUrl = await getUploadSession(
                    threadId,
                    file.name,
                    file.type
                );
            } else if (chatId && groupName && participants) {
                // Chat Upload
                const res = await prepareChatUpload(
                    chatId,
                    groupName,
                    participants,
                    file.name,
                    file.type,
                    file.size
                );
                uploadUrl = res.uploadUrl;
            } else {
                throw new Error("Invalid upload context");
            }

            if (!uploadUrl) throw new Error("Failed to get upload URL");

            // 2. Upload Chunks
            let start = 0;
            let gFile = null;

            while (start < file.size) {
                // Check Cancellation
                if (controller.signal.aborted) {
                    throw new Error("Upload Cancelled");
                }

                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append("chunk", chunk);

                const contentRange = `bytes ${start}-${end - 1}/${file.size}`;
                // Pass controller is tricky with server actions. Server actions don't typically accept signal directly in the same way fetch does locally unless wrapped.
                // However, we just check before sending each chunk. If the chunk takes long, we can't kill it mid-flight easily without advanced fetch setup in 'uploadChunk'.
                // Ideally, 'uploadChunk' uses a fetch with signals internally, but it's a server action. 
                // So checking here minimizes wasted bandwidth.
                const res = await uploadChunk(uploadUrl, formData, contentRange);

                if (res.status === 200 || res.status === 201) {
                    gFile = res.data;
                    updateUpload(item.id, { progress: 100 });
                    break;
                } else if (res.status === 308) {
                    start = end;
                    const percent = Math.round((end / file.size) * 100);
                    updateUpload(item.id, { progress: percent });
                } else {
                    throw new Error("Status: " + res.status);
                }
            }

            if (gFile) {
                const attachment = {
                    id: gFile.id,
                    name: gFile.name,
                    type: gFile.mimeType,
                    size: parseInt(gFile.size || '0'),
                    url: gFile.webViewLink,
                    driveId: gFile.id,
                    thumbnailLink: gFile.thumbnailLink || null
                };
                updateUpload(item.id, { status: 'completed', progress: 100, result: attachment });
                onSuccess(attachment);
            } else {
                throw new Error("Incomplete upload");
            }

        } catch (error: any) {
            if (error.message === "Upload Cancelled") {
                 updateUpload(item.id, { status: 'cancelled', error: 'Cancelled' });
            } else {
                console.error("Upload Error:", error);
                updateUpload(item.id, { status: 'error', error: error.message });
            }
        } finally {
            abortControllers.current.delete(item.id);
        }
    };

    const uploadFile = (
        file: File,
        context: {
            chatId?: string,
            groupName?: string,
            participants?: string[],
            taskId?: string,
            threadId?: string
        },
        onSuccess: (attachment: any) => void
    ) => {
        const newUpload: ChatUploadItem = {
            id: Math.random().toString(36).substring(7),
            file,
            name: file.name,
            ...context,
            progress: 0,
            status: 'pending'
        };

        setUploads(prev => [...prev, newUpload]);
        setIsManagerOpen(true);

        // Start upload immediately (non-blocking)
        processUpload(newUpload, onSuccess);
    };

    const clearCompleted = () => {
        setUploads(prev => prev.filter(u => u.status !== 'completed' && u.status !== 'cancelled'));
    };

    const cancelUpload = (id: string) => {
        const controller = abortControllers.current.get(id);
        if (controller) {
            controller.abort();
        } else {
             // If manual cancel of pending?
             updateUpload(id, { status: 'cancelled' });
        }
    };

    const toggleManager = () => setIsManagerOpen(prev => !prev);

    return (
        <ChatUploadContext.Provider value={{
            uploads,
            uploadFile,
            clearCompleted,
            cancelUpload,
            isManagerOpen,
            toggleManager,
            activeCount
        }}>
            {children}
            <ChatUploadManagerUI />
        </ChatUploadContext.Provider>
    );
}

// Upload Manager UI Component
function ChatUploadManagerUI() {
    const context = useContext(ChatUploadContext);
    if (!context) return null;
    const { uploads, isManagerOpen, toggleManager, clearCompleted, cancelUpload, activeCount } = context;

    if (uploads.length === 0) return null;

    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'uploading') return <span className="animate-spin text-indigo-400">⏳</span>;
        if (status === 'completed') return <span className="text-green-500">✓</span>;
        if (status === 'error') return <span className="text-red-500">✕</span>;
        if (status === 'cancelled') return <span className="text-zinc-500">∅</span>;
        return <span className="text-zinc-500">•</span>;
    };

    return (
        <div className={`fixed bottom-4 right-4 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all z-[9999] flex flex-col ${isManagerOpen ? 'h-auto max-h-80' : 'h-12'}`}>
            {/* Header */}
            <div 
                className="bg-zinc-800 p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-700/80 transition-colors"
                onClick={toggleManager}
            >
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    📎 {activeCount > 0 ? `アップロード中... (${activeCount})` : "アップロード完了"}
                    {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                </h4>
                <span className="text-xs text-zinc-400">{isManagerOpen ? '▼' : '▲'}</span>
            </div>
            
            {/* List */}
            {isManagerOpen && (
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-zinc-900/95 backdrop-blur-sm">
                    {uploads.map(u => (
                        <div key={u.id} className="bg-black/20 p-2 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-zinc-300 truncate max-w-[150px]" title={u.name}>{u.name}</span>
                                <div className="flex items-center gap-2">
                                     <StatusIcon status={u.status} />
                                     {(u.status === 'pending' || u.status === 'uploading') && (
                                         <button onClick={() => cancelUpload(u.id)} className="text-zinc-500 hover:text-white px-1" title="Cancel">✕</button>
                                     )}
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${u.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${u.progress}%` }}
                                ></div>
                            </div>
                            {u.error && <p className="text-[10px] text-red-400 mt-1 truncate">{u.error}</p>}
                        </div>
                    ))}

                    {activeCount === 0 && (
                        <button 
                            onClick={clearCompleted}
                            className="w-full py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded"
                        >
                            クリア
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Hook
export function useChatUpload() {
    const context = useContext(ChatUploadContext);
    if (!context) throw new Error("useChatUpload must be used within ChatUploadProvider");
    return context;
}
