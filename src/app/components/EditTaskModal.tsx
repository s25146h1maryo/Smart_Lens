"use client";

import { useState, useEffect, useRef } from "react";
import { Task } from "@/types";
import { Loader2, X, Calendar, User as UserIcon, Trash2, Save, Flag, Search, Check, Circle, PlayCircle, CheckCircle, Paperclip, FileIcon, ImageIcon, ExternalLink, Plus } from "lucide-react";
import { updateTask, deleteTask } from "@/app/actions/task";
import { format } from "date-fns";
import { useChatUpload } from "@/app/messages/ChatUploadContext";

interface EditTaskModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    users: any[];
    onTaskUpdate?: (task: Task) => void;
}

export default function EditTaskModal({ task, isOpen, onClose, users, onTaskUpdate }: EditTaskModalProps) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || "");
    const [priority, setPriority] = useState<Task['priority']>(task.priority);
    const [status, setStatus] = useState<Task['status']>(task.status);
    const [assigneeIds, setAssigneeIds] = useState<string[]>(Array.from(new Set(task.assigneeIds || [])));
    const [attachments, setAttachments] = useState<Task['attachments']>(task.attachments || []);
    
    // Upload Context
    const { uploadFile } = useChatUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingCount, setUploadingCount] = useState(0);

    // Assignee Search
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const filteredUsers = (users || []).filter(u => 
        (u.nickname || u.name || "").toLowerCase().includes(assigneeSearch.toLowerCase())
    );

    // Date Logic
    const [dateType, setDateType] = useState<'deadline' | 'period' | 'scheduled'>('deadline');
    const [isAllDay, setIsAllDay] = useState(task.isAllDay ?? true);
    const [date1, setDate1] = useState("");
    const [date2, setDate2] = useState("");
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isOpen && task) {
            setTitle(task.title);
            setDescription(task.description || "");
            setPriority(task.priority);
            setStatus(task.status);
            setAssigneeIds(Array.from(new Set(task.assigneeIds || [])));
            setAttachments(task.attachments || []);
            setIsAllDay(task.isAllDay ?? true);

            if (task.startDate && task.endDate && task.startDate !== task.endDate) {
                setDateType("period");
                setDate1(formatDateForInput(task.startDate, task.isAllDay ?? true));
                setDate2(formatDateForInput(task.endDate, task.isAllDay ?? true));
            } else if (task.startDate) {
                setDateType("scheduled");
                setDate1(formatDateForInput(task.startDate, task.isAllDay ?? true));
            } else if (task.dueDate) {
                setDateType("deadline");
                setDate1(formatDateForInput(task.dueDate, task.isAllDay ?? true));
            } else {
                setDateType("deadline");
                setDate1("");
            }
        }
    }, [isOpen, task]);

    const formatDateForInput = (timestamp: number, allDay: boolean) => {
        if (allDay) return format(new Date(timestamp), "yyyy-MM-dd");
        return format(new Date(timestamp), "yyyy-MM-dd'T'HH:mm");
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setIsSaving(true);

        try {
            let startDate: number | null = null;
            let endDate: number | null = null;
            let dueDate: number | null = null;

            const parseDate = (val: string) => val ? new Date(val).getTime() : null;

            if (dateType === 'deadline') {
                dueDate = parseDate(date1);
            } else if (dateType === 'scheduled') {
                startDate = parseDate(date1);
                endDate = startDate;
            } else if (dateType === 'period') {
                startDate = parseDate(date1);
                endDate = parseDate(date2);
            }

            const updatedData = {
                title,
                description,
                priority,
                status,
                assigneeIds,
                isAllDay,
                startDate,
                endDate,
                dueDate,
                attachments
            };

            await updateTask(task.id, task.threadId, updatedData);
            
            if (onTaskUpdate) {
                onTaskUpdate({
                    ...task,
                    ...updatedData,
                    updatedAt: Date.now()
                });
            }

            onClose();
        } catch (error) {
            console.error(error);
            alert("保存に失敗しました");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("本当にこのタスクを削除しますか？")) return;
        setIsDeleting(true);
        try {
            await deleteTask(task.id, task.threadId);
            onClose();
        } catch (error) {
            console.error(error);
            alert("削除に失敗しました");
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleAssignee = (uid: string) => {
        setAssigneeIds(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    // --- Attachment Logic ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setUploadingCount(prev => prev + files.length);
            
            files.forEach(file => {
                uploadFile(
                    file, 
                    { taskId: task.id, threadId: task.threadId }, 
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

    const removeAttachment = (driveFileId: string) => {
        if(!confirm("添付ファイルを削除しますか？")) return;
        setAttachments(prev => prev.filter(a => a.driveFileId !== driveFileId));
    };

    const isImage = (mimeType?: string) => mimeType?.startsWith('image/') ?? false;
    const imageAttachments = attachments.filter(a => isImage(a.mimeType));
    const fileAttachments = attachments.filter(a => !isImage(a.mimeType));

    // Dynamic Width: If images exist, wider modal. Else normal.
    const hasImages = imageAttachments.length > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`w-full ${hasImages ? 'max-w-5xl' : 'max-w-2xl'} rounded-2xl border border-white/10 bg-[#0A0A0B] shadow-2xl overflow-hidden flex flex-col h-[85vh] transition-all duration-300`}>
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-white/5 shrink-0">
                    <h2 className="font-bold text-zinc-100 flex items-center gap-2">
                        <span className="text-zinc-500 text-sm font-normal">タスク編集</span>
                    </h2>
                    <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Single Column */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    {/* Title & Status */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400">タイトル</label>
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-lg"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="タスクのタイトル"
                                />
                                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 shrink-0">
                                    <button onClick={() => setStatus('todo')} className={`p-2 rounded-lg ${status === 'todo' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="未着手"><Circle size={20} /></button>
                                    <button onClick={() => setStatus('in-progress')} className={`p-2 rounded-lg ${status === 'in-progress' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="進行中"><PlayCircle size={20} /></button>
                                    <button onClick={() => setStatus('done')} className={`p-2 rounded-lg ${status === 'done' ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="完了"><CheckCircle size={20} /></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400">詳細・メモ</label>
                        <textarea 
                            className="w-full h-32 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-all"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="タスクの詳細を入力..."
                        />
                    </div>

                    {/* Middle Section: Priority & Date & Assignees */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-6">
                            {/* Priority */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Flag size={14} /> 優先度</label>
                                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 w-full">
                                    {(['low', 'medium', 'high'] as const).map(p => (
                                        <button
                                            key={p} onClick={() => setPriority(p)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase transition-all ${priority === p ? (p === 'high' ? 'bg-red-500/20 text-red-400' : p === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400') : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Section */}
                            <div className="space-y-3 p-4 bg-zinc-900/30 border border-white/5 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Calendar size={14} /> 日時設定</label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-200">
                                        <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${isAllDay ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-500 bg-zinc-800'}`}>{isAllDay && <Check size={8} className="text-white" />}</div>
                                        <input type="checkbox" className="hidden" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} /> 終日
                                    </label>
                                </div>
                                <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                                        {(['deadline', 'period', 'scheduled'] as const).map(type => (
                                        <button key={type} className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-all ${dateType === type ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`} onClick={() => setDateType(type)}>{type === 'deadline' ? '期限' : type === 'period' ? '期間' : '予定日'}</button>
                                    ))}
                                </div>

                                <div className="space-y-3 pt-2">
                                    {dateType === 'period' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type={isAllDay ? "date" : "datetime-local"} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" value={date1} onChange={e => setDate1(e.target.value)} />
                                            <input type={isAllDay ? "date" : "datetime-local"} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" value={date2} onChange={e => setDate2(e.target.value)} />
                                        </div>
                                    ) : (
                                        <input type={isAllDay ? "date" : "datetime-local"} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" value={date1} onChange={e => setDate1(e.target.value)} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Assignees (Moved Here) */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><UserIcon size={14} /> 担当者</label>
                            <div className="border border-white/10 rounded-xl bg-black/20 overflow-hidden flex flex-col h-[280px]">
                                <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-white/5">
                                    <Search size={14} className="text-zinc-500" />
                                    <input 
                                        placeholder="担当者を検索..." 
                                        className="bg-transparent text-xs text-white outline-none w-full placeholder-zinc-600"
                                        value={assigneeSearch}
                                        onChange={e => setAssigneeSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {filteredUsers.length > 0 ? filteredUsers.map(u => {
                                        const isSelected = assigneeIds.includes(u.uid);
                                        return (
                                            <button key={u.uid} onClick={() => toggleAssignee(u.uid)} className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-bold border border-white/5">{(u.nickname?.[0] || u.name?.[0] || "?").toUpperCase()}</div>
                                                    <span className={`text-xs font-medium ${isSelected ? 'text-indigo-200' : 'text-zinc-300'}`}>{u.nickname || u.name}</span>
                                                </div>
                                                {isSelected && <Check size={14} className="text-indigo-400" />}
                                            </button>
                                        );
                                    }) : (
                                        <div className="text-center py-8 text-zinc-500 text-xs">該当者なし</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* File Attachments */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Paperclip size={14} /> 添付ファイル (Google Drive)</label>
                        
                        {/* File List */}
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:bg-white/5 transition-colors group">
                                        <a href={file.webViewLink || (file as any).url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                                <FileIcon size={12} />
                                            </div>
                                            <div className="truncate text-xs text-zinc-300">{file.name}</div>
                                        </a>
                                        <button onClick={() => removeAttachment(file.driveFileId)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400"><X size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload Button */}
                        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-800/30 hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-all group"
                        >
                            <Plus size={16} className="transition-transform group-hover:scale-110" />
                            <span className="text-xs font-bold">ファイルを追加</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-white/5 p-4 bg-white/5 flex items-center justify-between shrink-0">
                    <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-xs font-bold">
                        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 削除
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-xs font-bold transition-colors">キャンセル</button>
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving || uploadingCount > 0} 
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {(isSaving || uploadingCount > 0) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                            {uploadingCount > 0 ? "アップロード中..." : "変更を保存"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
