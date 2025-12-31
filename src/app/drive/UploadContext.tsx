"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { initializeUpload, uploadChunk, finalizeUpload } from "@/app/actions/drive_upload";
import { useRouter } from 'next/navigation';

// Constants
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

export interface UploadItem {
    id: string; 
    file: File;
    name: string; 
    parentId: string;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
    error?: string;
    description?: string; 
    isShared?: boolean;
}

interface UploadContextType {
    uploads: UploadItem[];
    uploadFiles: (files: FileList | File[], parentId: string, onSuccess?: (file: any) => void, isShared?: boolean) => void;
    clearCompleted: () => void;
    retryUpload: (id: string) => void;
    cancelUpload: (id: string) => void;
    isManagerOpen: boolean;
    toggleManager: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());
    const router = useRouter();

    // Derived State
    const activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length;

    // Auto-Hide Manager 3s after all completed
    useEffect(() => {
        if (activeUploads === 0 && uploads.length > 0) {
            const timer = setTimeout(() => {
                setUploads(prev => prev.filter(u => u.status !== 'completed'));
                setIsManagerOpen(false); 
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [activeUploads, uploads.length]);

    // Helper to update state safely
    const updateUpload = (id: string, updates: Partial<UploadItem>) => {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    };

    const processUpload = async (item: UploadItem, onSuccess?: (file: any) => void) => {
        // Double check status to avoid re-running active ones
        // Actually this function is called only once per new batch.
        updateUpload(item.id, { status: 'uploading', error: undefined, progress: 0 });
        const { file, parentId, isShared } = item;

        // Register controller
        const controller = new AbortController();
        abortControllers.current.set(item.id, controller);

        try {
            // 1. Init
            const { uploadUrl } = await initializeUpload(file.name, file.type, parentId, file.size, isShared);
            if (!uploadUrl) throw new Error("Failed to start upload");

            // 2. Chunked Loop
            let start = 0;
            let finalData = null;

            while (start < file.size) {
                 // Check cancellation
                 if (controller.signal.aborted) throw new Error("Upload Cancelled");
                 
                 const end = Math.min(start + CHUNK_SIZE, file.size);
                 const chunk = file.slice(start, end);
                 const formData = new FormData();
                 formData.append("chunk", chunk);
                 const contentRange = `bytes ${start}-${end - 1}/${file.size}`;
                 
                 const result = await uploadChunk(uploadUrl, formData, contentRange);
                 
                 if (result.status === 200 || result.status === 201) {
                     finalData = result.data;
                     updateUpload(item.id, { progress: 100 });
                     break;
                 } else if (result.status === 308) {
                     start = end;
                     const percent = Math.round((start / file.size) * 100);
                     updateUpload(item.id, { progress: percent });
                 } else {
                     throw new Error("Status: " + result.status);
                 }
            }

            // 3. Finalize
            if (finalData) {
                await finalizeUpload(file.name, file.type, parentId, finalData, isShared);
                updateUpload(item.id, { status: 'completed', progress: 100 });
                if (onSuccess) onSuccess(finalData);
                router.refresh(); // Refresh data wherever we are (imperfect but helpful)
            } else {
                 throw new Error("Incomplete");
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

    const uploadFiles = (files: FileList | File[], parentId: string, onSuccess?: (file: any) => void, isShared?: boolean) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const newUploads: UploadItem[] = fileArray.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            name: file.name,
            parentId,
            progress: 0,
            status: 'pending',
            isShared
        }));

        setUploads(prev => [...prev, ...newUploads]);
        setIsManagerOpen(true);

        // Start them all concurrently
        newUploads.forEach(u => processUpload(u, onSuccess));
    };

    const clearCompleted = () => {
        setUploads(prev => prev.filter(u => u.status !== 'completed' && u.status !== 'cancelled'));
    };

    const retryUpload = (id: string) => {
        const item = uploads.find(u => u.id === id);
        if (item) processUpload(item);
    };

    const cancelUpload = (id: string) => {
        const controller = abortControllers.current.get(id);
        if (controller) {
            controller.abort();
        } else {
            // Cancel pending items immediately
            updateUpload(id, { status: 'cancelled' });
        }
    };

    const toggleManager = () => setIsManagerOpen(prev => !prev);

    return (
        <UploadContext.Provider value={{ 
            uploads, 
            uploadFiles, 
            clearCompleted, 
            retryUpload, 
            cancelUpload, 
            isManagerOpen, 
            toggleManager 
        }}>
            {children}
            {/* We could render the Manager UI here directly! */}
            <UploadManagerUI />
        </UploadContext.Provider>
    );
}

// Sub-component for UI
function UploadManagerUI() {
    const context = useContext(UploadContext);
    if (!context) return null;
    const { uploads, isManagerOpen, toggleManager, clearCompleted, cancelUpload } = context;

    if (uploads.length === 0) return null;

    const activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length;

    // UI Icons
    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'uploading') return <span className="animate-spin text-indigo-400">⏳</span>; 
        if (status === 'completed') return <span className="text-green-500">✓</span>;
        if (status === 'completed') return <span className="text-green-500">✓</span>;
        if (status === 'error') return <span className="text-red-500">✕</span>;
        if (status === 'cancelled') return <span className="text-zinc-500">∅</span>;
        return <span className="text-zinc-500">•</span>;
    };

    return (
         <div className={`fixed bottom-4 right-4 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all z-[9999] flex flex-col ${isManagerOpen ? 'h-auto max-h-96' : 'h-12'}`}>
             {/* Header */}
             <div 
                className="bg-zinc-800 p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-700/80 transition-colors"
                onClick={toggleManager}
             >
                 <h4 className="text-sm font-bold text-white flex items-center gap-2">
                     {activeUploads > 0 ? `Uploading ${activeUploads} file(s)...` : "Uploads Finished"}
                     {activeUploads > 0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
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

                     {activeUploads === 0 && (
                         <button 
                            onClick={clearCompleted}
                            className="w-full py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded"
                         >
                             Clear Completed
                         </button>
                     )}
                 </div>
             )}
        </div>
    );
}

// Hook
export function useUpload() {
    const context = useContext(UploadContext);
    if (!context) throw new Error("useUpload must be used within UploadProvider");
    return context;
}
