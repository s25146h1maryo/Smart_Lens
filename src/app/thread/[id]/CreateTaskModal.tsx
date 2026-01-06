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
    
    // User Selection State
    const [users, setUsers] = useState<any[]>([]);
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [assigneeSearch, setAssigneeSearch] = useState("");
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile } = useChatUpload();

    // Fetch Users on Mount
    useEffect(() => {
        import("@/app/actions/user").then(({ getActiveUsers }) => {
            getActiveUsers().then(setUsers).catch(console.error);
        });
    }, []);

    const toggleAssignee = (uid: string) => {
        setAssigneeIds(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const filteredUsers = users.filter(u => 
        (u.nickname || u.name || "").toLowerCase().includes(assigneeSearch.toLowerCase())
    );

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
                assigneeIds: assigneeIds, 
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
            <div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl w-[600px] max-w-[90%] text-white flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">タスク作成</h3>
                    <button onClick={onClose}><X size={20} className="text-zinc-500 hover:text-white" /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    
                    <div>
                        <label className="text-sm text-zinc-400 mb-1 block">タイトル <span className="text-red-400">*</span></label>
                        <input name="title" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" required placeholder="タスク名を入力" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-sm text-zinc-400 mb-1 block">開始日</label>
                            <input name="startDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white [color-scheme:dark]" />
                        </div>
                        <div>
                            <label className="text-sm text-zinc-400 mb-1 block">終了日</label>
                            <input name="endDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white [color-scheme:dark]" />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-1 block">期限 (Due Date)</label>
                        <input name="dueDate" type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white [color-scheme:dark]" />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">担当者 ({assigneeIds.length}名)</label>
                        <div className="border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
                            <input 
                                className="w-full bg-white/5 p-2 text-xs text-white border-b border-zinc-800 outline-none placeholder-zinc-500" 
                                placeholder="名前で検索..."
                                value={assigneeSearch}
                                onChange={e => setAssigneeSearch(e.target.value)}
                            />
                            <div className="h-40 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {filteredUsers.map(u => (
                                    <div 
                                        key={u.id} 
                                        onClick={() => toggleAssignee(u.id)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${assigneeIds.includes(u.id) ? 'bg-indigo-500/20 shadow-inner' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px]">
                                                {u.nickname?.[0] || u.name?.[0]}
                                            </div>
                                            <span className={`text-sm ${assigneeIds.includes(u.id) ? 'text-indigo-200 font-bold' : 'text-zinc-300'}`}>
                                                {u.nickname || u.name}
                                            </span>
                                        </div>
                                        {assigneeIds.includes(u.id) && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                                    </div>
                                ))}
                                {filteredUsers.length === 0 && <div className="text-center text-xs text-zinc-600 py-4">ユーザーが見つかりません</div>}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">添付ファイル</label>
                        {attachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                        <div className="flex-1 truncate text-xs text-zinc-300">{file.name}</div>
                                        <button type="button" onClick={() => removeAttachment(idx)} className="p-1 text-zinc-500 hover:text-red-400"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-800/30 text-xs text-zinc-400 hover:text-indigo-400 transition-all"
                        >
                            <Plus size={14} /> ファイルを追加
                        </button>
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white text-sm" disabled={isSubmitting}>キャンセル</button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 text-sm shadow-lg shadow-indigo-500/20" 
                            disabled={isSubmitting || uploadingCount > 0}
                        >
                            {(isSubmitting || uploadingCount > 0) && <Loader2 size={14} className="animate-spin" />}
                            作成
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
