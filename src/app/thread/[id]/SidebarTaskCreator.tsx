"use client";

import { useState, useRef, useEffect } from "react";
import { createTask } from "@/app/actions/task";
import { getActiveUsers } from "@/app/actions/user";
import { getUploadSession } from "@/app/actions/thread";
import { analyzeDriveImage } from "@/app/actions/ai_task";
import { Sparkles, Paperclip, Wrench, X, File as FileIcon } from "lucide-react";
import styles from "./thread.module.css";
import { useChatUpload } from "@/app/messages/ChatUploadContext";

interface User {
    id: string;
    name: string;
    image?: string;
    nickname?: string;
}

interface SuggestedTask {
    title: string;
    description: string;
}

export default function SidebarTaskCreator({ 
    threadId, 
    users = [], 
    onTaskCreated 
}: { 
    threadId: string, 
    users?: User[],
    onTaskCreated: (task: any) => void 
}) {
    // State Definitions
    const [title, setTitle] = useState("");
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dateType, setDateType] = useState<'deadline' | 'period' | 'scheduled'>('deadline');
    const [isAllDay, setIsAllDay] = useState(true);
    const [date1, setDate1] = useState("");
    const [date2, setDate2] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<{ code: string, message: string } | null>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploadingCount, setUploadingCount] = useState(0);

    // Context & Refs
    const { uploadFile } = useChatUpload();
    const assigneeRef = useRef<HTMLDivElement>(null);
    const aiInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Assignee Search State
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);

    // AI State
    const [aiStatus, setAiStatus] = useState<'Idle' | 'Analyzing' | 'Review'>('Idle');
    const [aiSuggestions, setAiSuggestions] = useState<SuggestedTask[]>([]);

    // Close select on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
                setIsAssigneeOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter Users
    const filteredUsers = users.filter(u => 
        (u.nickname || u.name || "").toLowerCase().includes(assigneeSearch.toLowerCase())
    );

    const toggleAssignee = (uid: string) => {
        setAssigneeIds(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    // --- AI Logic ---
    const uploadFileToDrive = async (file: File, threadId: string, prefix: string): Promise<any> => {
        const uploadUrl = await getUploadSession(threadId, `${prefix}${file.name}`, file.type);
        if (!uploadUrl) throw new Error("Failed to initialize upload session.");

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            
            xhr.onload = async () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } catch (e) {
                         reject(new Error("Invalid JSON response from Drive"));
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            };
            
            xhr.onerror = () => reject(new Error("Network Error during upload. Check connection."));
            xhr.send(file);
        });
    };

    const handleAiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAiStatus("Analyzing");
        setError(null);
        setAiSuggestions([]);

        try {
            console.log("Starting AI Upload (Client Direct) for:", file.name);
            const driveFile = await uploadFileToDrive(file, threadId, "AI_Source_");
            const tasks = await analyzeDriveImage(driveFile.id, file.type);
            
            if (tasks.length === 0) {
                 setAiStatus("Idle");
                 setError({ code: 'AI_NO_TASKS', message: 'タスクが見つかりませんでした。別の画像を試してください。' });
                 return;
            }

            setAiSuggestions(tasks);
            setAiStatus("Review");
        } catch (e: any) {
            console.error("AI Process Error:", e);
            setAiStatus("Idle");
            setError({ code: 'AI_ERROR', message: e.message || 'AI解析中にエラーが発生しました' });
        }
    };

    // --- File Upload Logic ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setUploadingCount(prev => prev + fileArray.length);

        fileArray.forEach(file => {
            uploadFile(
                file,
                { threadId }, 
                (attachment) => {
                    setAttachments(prev => [...prev, attachment]);
                    setUploadingCount(prev => Math.max(0, prev - 1));
                }
            );
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (driveId: string) => {
        setAttachments(prev => prev.filter(a => a.driveFileId !== driveId && a.id !== driveId));
    };

    const resetForm = () => {
        setTitle("");
        setAssigneeIds([]);
        setAssigneeSearch("");
        setDateType("deadline");
        setDate1("");
        setDate2("");
        setIsAllDay(true);
        setPriority("medium");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError(null);
    };

    // --- Manual Submit ---
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        // Validation
        if (!date1) {
            setError({ code: 'VALIDATION', message: '日付を設定してください（必須項目です）。' });
            setIsSubmitting(false);
            return;
        }

        if (assigneeIds.length === 0) {
            setError({ code: 'VALIDATION', message: '担当者を設定してください（必須項目です）。' });
            setIsSubmitting(false);
            return;
        }

        try {
            let startDate = null, endDate = null, dueDate = null;
            if (dateType === 'deadline') {
                dueDate = new Date(date1).getTime();
            } else if (dateType === 'scheduled') {
                startDate = new Date(date1).getTime();
                endDate = startDate; 
            } else if (dateType === 'period') {
                startDate = new Date(date1).getTime();
                if (date2) endDate = new Date(date2).getTime();
            }

            const result = await createTask(threadId, title, 'todo', {
                priority,
                startDate, endDate, dueDate,
                assigneeIds: assigneeIds,
                isAllDay,
                attachments: attachments.map(f => ({
                    name: f.name,
                    driveFileId: f.driveFileId || f.id,
                    mimeType: f.mimeType || f.type,
                    webViewLink: f.webViewLink || f.url
                }))
            });

            if (!result.success && result.error) {
                setError(result.error);
            } else {
                console.log("Task Created Successfully:", result.task);
                resetForm();
                if(result.task) {
                    onTaskCreated(result.task);
                }
            }

        } catch (e: any) {
            console.error("Manual Submit Error:", e);
            setError({ code: 'UNKNOWN_ERROR', message: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            
            {/* AI Section */}
            <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/10 to-purple-900/10 p-1">
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                     <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-400 shadow-xl">
                        <Wrench size={14} /> <span>メンテナンス中</span>
                     </div>
                </div>
                
                <div className="flex flex-col items-center gap-3 rounded-lg bg-zinc-900/40 p-4 text-center backdrop-blur-sm">
                    <div className="text-sm font-bold text-indigo-400 flex items-center gap-2"><Sparkles size={16} /> AIアシスタント</div>
                    
                    <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/20 px-4 py-3 text-sm font-bold text-indigo-300 opacity-50">
                         画像を解析してタスク生成
                    </button>
                    
                    <p className="text-[10px] text-zinc-500">
                        現在機能を調整中です。しばらくお待ちください。
                    </p>
                </div>

                 <input 
                    type="file" 
                    hidden 
                    accept="image/*,application/pdf" 
                    ref={aiInputRef}
                    onChange={handleAiUpload} 
                />
            </div>
            
            <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                <div className="h-px flex-1 bg-white/10"></div>
                <span>新規タスク作成</span>
                <div className="h-px flex-1 bg-white/10"></div>
            </div>

            {/* MANUAL SECTION */}
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                        [{error.code}] {error.message}
                    </div>
                )}
                
                {/* Title Input */}
                <input 
                    className="w-full rounded-xl border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-white placeholder-zinc-600 transition-all focus:border-indigo-500/50 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="タスクタイトルを入力..." 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />

                {/* Multi-Select Assignee UI */}
                <div>
                     <label className="text-xs font-medium text-zinc-500 mb-1 block ml-1">担当者 ({assigneeIds.length})</label>
                     <div className="border border-white/5 rounded-xl bg-zinc-900/50 overflow-hidden flex flex-col max-h-[200px]">
                        <input 
                            className="bg-zinc-900/50 border-b border-white/5 p-2 text-xs text-white outline-none w-full placeholder-zinc-600"
                            placeholder="名前で検索..."
                            value={assigneeSearch}
                            onChange={e => setAssigneeSearch(e.target.value)}
                        />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1">
                            {filteredUsers.map(u => (
                                <div 
                                    key={u.id} 
                                    onClick={() => toggleAssignee(u.id)}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${assigneeIds.includes(u.id) ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="min-w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300">
                                            {(u.nickname?.[0] || u.name?.[0] || "?").toUpperCase()}
                                        </div>
                                        <span className={`text-xs truncate ${assigneeIds.includes(u.id) ? 'text-indigo-200 font-bold' : 'text-zinc-300'}`}>
                                            {u.nickname || u.name}
                                        </span>
                                    </div>
                                    {assigneeIds.includes(u.id) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                                </div>
                            ))}
                             {filteredUsers.length === 0 && <div className="text-center text-[10px] text-zinc-600 py-2">ユーザーが見つかりません</div>}
                        </div>
                    </div>
                </div>

                {/* Custom Date Type Tabs */}
                <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/30 p-3">
                    <div className="flex items-center justify-between">
                         <div className="flex gap-1 rounded-lg bg-black/20 p-1 flex-1 mr-4">
                            {(['deadline', 'period', 'scheduled'] as const).map(type => (
                                <button 
                                    key={type}
                                    type="button"
                                    className={`
                                        flex-1 rounded-md py-1.5 text-xs font-medium transition-all
                                        ${dateType === type ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}
                                    `}
                                    onClick={() => setDateType(type)}
                                >
                                    {type === 'deadline' ? '期限' : type === 'period' ? '期間' : '予定日'}
                                </button>
                            ))}
                        </div>
                        
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-200">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAllDay ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-500 bg-zinc-800'}`}>
                                {isAllDay && <span className="text-white">✓</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                            終日
                        </label>
                    </div>
                    
                    <div className="space-y-2">
                        {dateType === 'deadline' && (
                           <input 
                                type={isAllDay ? "date" : "datetime-local"} 
                                required 
                                className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" 
                                value={date1} 
                                onChange={e => setDate1(e.target.value)} 
                           />
                        )}
                        {dateType === 'scheduled' && (
                           <input 
                                type={isAllDay ? "date" : "datetime-local"} 
                                required 
                                className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" 
                                value={date1} 
                                onChange={e => setDate1(e.target.value)} 
                           />
                        )}
                        {dateType === 'period' && (
                            <div className="flex flex-col gap-2">
                                <div>
                                    <span className="ml-1 text-[10px] text-zinc-500">開始{isAllDay ? '日' : '日時'}</span>
                                    <input 
                                        type={isAllDay ? "date" : "datetime-local"} 
                                        required 
                                        className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" 
                                        value={date1} 
                                        onChange={e => setDate1(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <span className="ml-1 text-[10px] text-zinc-500">終了{isAllDay ? '日' : '日時'}</span>
                                    <input 
                                        type={isAllDay ? "date" : "datetime-local"} 
                                        className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]" 
                                        value={date2} 
                                        onChange={e => setDate2(e.target.value)} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Priority Selector */}
                <div className="flex flex-col gap-2">
                    <div className="ml-1 text-[10px] text-zinc-500">優先度 (Priority)</div>
                    <div className="flex gap-2">
                        {['low', 'medium', 'high'].map((p) => (
                            <button
                                key={p}
                                type="button"
                                className={`
                                    flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all
                                    ${priority === p 
                                        ? p === 'high' ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                                        : p === 'medium' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                        : 'bg-zinc-900/30 border-white/5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                                    }
                                `}
                                onClick={() => setPriority(p as any)}
                            >
                                {p === 'low' ? '低' : p === 'medium' ? '中' : '高'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* File Attachments */}
                <div className="space-y-3">
                    <div 
                        className="flex w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 py-3 text-xs text-zinc-400 gap-1 hover:bg-zinc-800/50 hover:text-zinc-200 hover:border-white/20 transition-all cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip size={14} /> <span>ファイルを添付</span>
                    </div>
                    <input 
                        type="file" 
                        multiple
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload}
                    />

                    {/* Attachment List */}
                    {attachments.length > 0 && (
                        <div className="space-y-2">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-white/5">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                            <FileIcon size={12} />
                                        </div>
                                        <span className="text-xs text-zinc-300 truncate max-w-[180px]">{file.name}</span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => removeAttachment(file.driveFileId || file.id)} 
                                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <X size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting || uploadingCount > 0}
                    className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {uploadingCount > 0 ? "アップロード中..." : isSubmitting ? '作成中...' : 'タスクを作成'}
                </button>
            </form>
        </div>
    );
}
