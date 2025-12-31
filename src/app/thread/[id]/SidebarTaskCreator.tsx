"use client";

import { useState, useRef, useEffect } from "react";
import { createTask } from "@/app/actions/task";
import { getActiveUsers } from "@/app/actions/user";
import { getUploadSession } from "@/app/actions/thread";
import { analyzeDriveImage } from "@/app/actions/ai_task";
import { Sparkles, Paperclip, Wrench, X, File as FileIcon } from "lucide-react";
import styles from "./thread.module.css";
import { useChatUpload } from "@/app/messages/ChatUploadContext";
// import { useRouter } from "next/navigation"; // Not needed for refresh anymore

// Define User type based on getActiveUsers return
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
    // const router = useRouter(); // For refreshing the list
    const [title, setTitle] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dateType, setDateType] = useState<'deadline' | 'period' | 'scheduled'>('deadline');
    const [isAllDay, setIsAllDay] = useState(true);
    const [date1, setDate1] = useState("");
    const [date2, setDate2] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<{ code: string, message: string } | null>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    
    // Upload Context
    const { uploadFile } = useChatUpload();

    // Custom Select State
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
    const assigneeRef = useRef<HTMLDivElement>(null);

    // AI & File State
    const [aiStatus, setAiStatus] = useState<'Idle' | 'Analyzing' | 'Review'>('Idle');
    const [aiSuggestions, setAiSuggestions] = useState<SuggestedTask[]>([]);
    const aiInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileStats, setFileStats] = useState("");

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

    // --- AI Logic (Temporarily Disabled per User Request due to CORS) ---
    
    const uploadFileToDrive = async (file: File, threadId: string, prefix: string): Promise<any> => {
        // 1. Get Session URL from Server
        const uploadUrl = await getUploadSession(threadId, `${prefix}${file.name}`, file.type);
        if (!uploadUrl) throw new Error("Failed to initialize upload session.");

        // 2. Upload directly from Client (XHR for reliability/progress)
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

    const handleAiClick = () => {
        aiInputRef.current?.click();
    };

    const handleAiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAiStatus("Analyzing");
        setError(null);
        setAiSuggestions([]);

        try {
            console.log("Starting AI Upload (Client Direct) for:", file.name);
            
            // Upload
            const driveFile = await uploadFileToDrive(file, threadId, "AI_Source_");
            console.log("AI File Uploaded:", driveFile.id);

            // Analyze
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

    const handleAiApprove = async (task: SuggestedTask) => {
        try {
            // Assign to current user by default or leave empty? 
            // Better to leave empty or use default logic.
            const result = await createTask(threadId, task.title, 'todo', {
                // description: task.description 
            });
            if (result.success && result.task) {
                onTaskCreated(result.task);
            }
            setAiSuggestions(prev => prev.filter(t => t !== task));
            if (aiSuggestions.length <= 1) {
                setAiStatus("Idle");
            }
        } catch(e:any) {
            setError({ code: 'CREATE_FAILED', message: e.message });
        }
    };
    

    const resetForm = () => {
        setTitle("");
        setAssigneeId("");
        setDateType("deadline");
        setDate1("");
        setDate2("");
        setIsAllDay(true);
        setPriority("medium");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError(null);
    }
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            uploadFile(
                file,
                { threadId }, // Context for Task Upload (Task ID not yet known, but Thread ID is)
                (attachment) => {
                    setAttachments(prev => [...prev, attachment]);
                }
            );
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (driveId: string) => {
        setAttachments(prev => prev.filter(a => a.driveFileId !== driveId && a.id !== driveId));
    };

    // --- Manual Logic ---
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        // 1. Validation: Date is mandatory
        if (!date1) {
            setError({ code: 'VALIDATION', message: '日付を設定してください（必須項目です）。' });
            setIsSubmitting(false);
            return;
        }

        // 2. Validation: Assignee is mandatory
        const finalAssignees = assigneeId === 'ALL' 
            ? users.map(u => u.id) 
            : (assigneeId ? [assigneeId] : []);
        
        if (finalAssignees.length === 0) {
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

            /*
            // Old Manual Upload Logic Removed
            */

            const result = await createTask(threadId, title, 'todo', {
                priority,
                startDate, endDate, dueDate,
                assigneeIds: finalAssignees,
                isAllDay,
                attachments
            });

            if (!result.success && result.error) {
                setError(result.error);
            } else {
                console.log("Task Created Successfully:", result.task);
                resetForm();
                // Call parent callback for Optimistic Update
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

    const getAssigneeLabel = () => {
        if (!assigneeId) return "担当者を選択 (必須)";
        if (assigneeId === 'ALL') return "全員 (All Members)";
        const user = users.find(u => u.id === assigneeId);
        return user ? (user.nickname || user.name || "不明なユーザー") : "選択してください";
    };

    return (
        <div className="flex flex-col gap-6">
            
            {/* AI Section (Premium Maintenance Mode) */}
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

                {/* Custom Assignee Select */}
                <div className="relative" ref={assigneeRef}>
                    <div 
                        className={`
                            flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-zinc-900/50 px-4 py-3 transition-all hover:bg-zinc-900 hover:border-white/10
                            ${isAssigneeOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500/50' : ''}
                        `}
                        onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                    >
                        <span className={`text-sm ${assigneeId ? 'text-white' : 'text-zinc-500'}`}>
                            {getAssigneeLabel()}
                        </span>
                        <span className="text-xs text-zinc-600">▼</span>
                    </div>
                    
                    {isAssigneeOpen && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-1 shadow-2xl backdrop-blur-xl">
                            <div 
                                className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/10"
                                onClick={() => { setAssigneeId('ALL'); setIsAssigneeOpen(false); }}
                            >
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">ALL</span>
                                <span className="text-sm text-zinc-300">全員 (全メンバー)</span>
                            </div>
                            {users.filter(u => 
                                u.nickname !== "Unknown" && 
                                u.name !== "Unknown" &&
                                (u.nickname || u.name) && 
                                (u.nickname || u.name).trim() !== ""
                            ).map(user => (
                                <div 
                                    key={user.id} 
                                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/10"
                                    onClick={() => { setAssigneeId(user.id); setIsAssigneeOpen(false); }}
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                                        {(user.nickname?.[0] || user.name?.[0] || "U").toUpperCase()}
                                    </span>
                                    <span className="text-sm text-zinc-300">{user.nickname || user.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
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
                                className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                value={date1} 
                                onChange={e => setDate1(e.target.value)} 
                           />
                        )}
                        {dateType === 'scheduled' && (
                           <input 
                                type={isAllDay ? "date" : "datetime-local"} 
                                required 
                                className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
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
                                        className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                        value={date1} 
                                        onChange={e => setDate1(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <span className="ml-1 text-[10px] text-zinc-500">終了{isAllDay ? '日' : '日時'}</span>
                                    <input 
                                        type={isAllDay ? "date" : "datetime-local"} 
                                        className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
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
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? '作成中...' : 'タスクを作成'}
                </button>
            </form>
        </div>
    );
}
