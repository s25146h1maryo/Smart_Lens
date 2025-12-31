"use client";

import { createTask } from "@/app/actions/task";
import { useState } from "react";
import styles from "./thread.module.css";
import { getUploadSession } from "@/app/actions/thread";
import DriveUploadButton from "@/app/drive/DriveUploadButton";
import { Paperclip } from "lucide-react";

export default function CreateTaskModal({ 
    threadId, 
    onClose 
}: { 
    threadId: string, 
    onClose: () => void 
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        try {
            const title = formData.get("title") as string;
            const startDateStr = formData.get("startDate") as string;
            const endDateStr = formData.get("endDate") as string;
            const dueDateStr = formData.get("dueDate") as string;
            // Note: attachments are already uploaded and in state

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
                    driveFileId: f.id,
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
                        
                        {/* List Uploaded Files */}
                        {attachments.length > 0 && (
                            <ul className="mb-2 space-y-1">
                                {attachments.map((f, i) => (
                                    <li key={i} className="text-xs bg-zinc-800 p-2 rounded flex justify-between items-center">
                                        <div className="flex items-center gap-1"><Paperclip size={12} /> {f.name}</div>
                                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">×</button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <DriveUploadButton 
                            parentId="task_attachments" 
                            onSuccess={(file) => {
                                // file object from Google Response might vary. 
                                // finalizeUpload returns { success: true, item: ... }
                                // DriveUploadButton now calls onSuccess(finalData from Google) which is the Google File Object.
                                // Wait, DriveUploadButton implementation:
                                // const gFile = await res.json(); onSuccess(gFile);
                                // So 'file' here is clean Google File object (id, name, mimeType, webViewLink).
                                if (file) {
                                    setAttachments(prev => [...prev, file]);
                                }
                            }} 
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white" disabled={isSubmitting}>キャンセル</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold" disabled={isSubmitting}>
                            {isSubmitting ? '作成中...' : '作成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
