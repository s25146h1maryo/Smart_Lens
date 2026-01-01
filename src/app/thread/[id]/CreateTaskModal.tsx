"use client";

import { createTask } from "@/app/actions/task";
import { useState, useRef } from "react";
import styles from "./thread.module.css";
import { Paperclip, Loader2, FileIcon, X, Plus } from "lucide-react";
import { useChatUpload } from "@/app/messages/ChatUploadContext";

export default function CreateTaskModal({ 
    threadId, 
    onClose 
}: { 
    threadId: string, 
    onClose: () => void 
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploadingCount, setUploadingCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile } = useChatUpload();

    // Upload Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setUploadingCount(prev => prev + files.length);
            
            files.forEach(file => {
                uploadFile(
                    file, 
                    { threadId }, 
                    (attachment) => {
                        setAttachments(prev => [...prev, {
                            name: attachment.name,
                            driveFileId: attachment.id,
                            mimeType: attachment.type,
                            webViewLink: attachment.url
                        }]);
                        setUploadingCount(prev => Math.max(0, prev - 1));
                    }
                );
            });
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        try {
            const title = formData.get("title") as string;
            const startDateStr = formData.get("startDate") as string;
            const endDateStr = formData.get("endDate") as string;
            const dueDateStr = formData.get("dueDate") as string;

            const startDate = startDateStr ? new Date(startDateStr).getTime() : undefined;
            const endDate = endDateStr ? new Date(endDateStr).getTime() : undefined;
            const dueDate = dueDateStr ? new Date(dueDateStr).getTime() : undefined;

            await createTask(threadId, title, 'todo', {
                startDate,
                endDate,
                dueDate,
                assigneeIds: [], // TODO: Add Member Selector
                attachments: attachments.map(f => ({
                    name: f.name,
                    driveFileId: f.driveFileId,
                    mimeType: f.mimeType,
                    webViewLink: f.webViewLink
                }))
            });
            
            onClose();
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
            <div style={{ background: '#18181b', padding: '24px', borderRadius: '16px', width: '500px', maxWidth: '90%', border: '1px solid #333', color: 'white' }}>
                <h3 className="text-xl font-bold mb-4">タスク作成</h3>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    
                    <div>
                        <label className="text-sm text-zinc-400 mb-1 block">タイトル</label>
                        <input name="title" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white" required placeholder="タスク名を入力" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-sm text-zinc-400 mb-1 block">開始日</label>
                            <input name="startDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white" />
                        </div>
                        <div>
                            <label className="text-sm text-zinc-400 mb-1 block">終了日</label>
                            <input name="endDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-1 block">期限 (Due Date)</label>
                        <input name="dueDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white" />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">添付ファイル</label>
                        
                        {attachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                        <a href={file.webViewLink || file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none md:pointer-events-auto">
                                            <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                                <FileIcon size={12} />
                                            </div>
                                            <div className="truncate text-xs text-zinc-300">{file.name}</div>
                                        </a>
                                        <button type="button" onClick={() => removeAttachment(idx)} className="p-1 text-zinc-500 hover:text-red-400"><X size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-800/30 hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-all text-sm"
                        >
                            <Plus size={14} /> ファイルを追加
                        </button>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white" disabled={isSubmitting}>キャンセル</button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                            disabled={isSubmitting || uploadingCount > 0}
                        >
                            {(isSubmitting || uploadingCount > 0) && <Loader2 size={16} className="animate-spin" />}
                            {uploadingCount > 0 ? 'アップロード中...' : isSubmitting ? '作成中...' : '作成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
