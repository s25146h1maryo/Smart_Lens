"use client";

import { Task } from "@/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { X, Calendar, User, AlignLeft, Link as LinkIcon, AlertCircle, Pin, CalendarDays } from "lucide-react";

export default function TaskDetailModal({ task, onClose, users = [] }: { task: Task & { threadTitle: string, isExternal?: boolean }, onClose: () => void, users?: any[] }) {
    if (!task) return null;

    const assignees = task.assigneeIds?.map(id => users.find(u => u.id === id)).filter(Boolean) || [];
    const isExternal = task.isExternal;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg bg-[#050510] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-start justify-between bg-white/5">
                    <div>
                        <div className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-2">
                             <span className="opacity-75">#{task.id.slice(0, 6)}</span>
                             <span>/</span>
                             <span>{task.threadTitle}</span>
                             {isExternal && <span className="bg-slate-700 text-white px-1.5 rounded text-[10px]">EXT</span>}
                        </div>
                        <h2 className="text-xl font-bold text-white leading-tight">{task.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Priority & Status (Internal Only) */}
                    {!isExternal && (
                        <div className="flex gap-3">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                task.priority === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                task.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                             }`}>
                                {task.priority || 'Medium'} Priority
                             </span>
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-zinc-800 border-zinc-700 text-zinc-300`}>
                                {task.status}
                             </span>
                        </div>
                    )}

                    {/* Description */}
                    {task.description && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                                <AlignLeft className="w-4 h-4" /> Description
                            </div>
                            <p className="text-sm text-zinc-300 bg-white/5 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        {task.dueDate && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                                    <AlertCircle className="w-3 h-3" /> Deadline
                                </div>
                                <div className="text-sm font-mono text-zinc-200 bg-red-500/5 px-2 py-1.5 rounded border border-red-500/10">
                                    {format(new Date(task.dueDate), 'yyyy/MM/dd (EEE)', { locale: ja })}
                                </div>
                            </div>
                        )}
                         {task.startDate && task.endDate && (
                            <div className="space-y-1 col-span-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                                    <CalendarDays className="w-3 h-3" /> Period
                                </div>
                                <div className="text-sm font-mono text-zinc-200 bg-indigo-500/5 px-2 py-1.5 rounded border border-indigo-500/10 flex items-center gap-2 flex-wrap">
                                    <span>{format(new Date(task.startDate), 'yyyy/MM/dd', { locale: ja })}</span>
                                    {!(task.isAllDay) && <span className="text-zinc-400 text-xs ml-0.5">{format(new Date(task.startDate), 'HH:mm')}</span>}
                                    
                                    <span className="text-zinc-500 mx-1">→</span>
                                    
                                    <span>{format(new Date(task.endDate), 'yyyy/MM/dd', { locale: ja })}</span>
                                    {!(task.isAllDay) && <span className="text-zinc-400 text-xs ml-0.5">{format(new Date(task.endDate), 'HH:mm')}</span>}
                                    
                                    {(task.isAllDay) && <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1 ml-2">終日</span>}
                                </div>
                            </div>
                        )}
                        {!task.endDate && task.startDate && (
                             <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                                    <Pin className="w-3 h-3" /> Planned
                                </div>
                                <div className="text-sm font-mono text-zinc-200 bg-sky-500/5 px-2 py-1.5 rounded border border-sky-500/10">
                                    {format(new Date(task.startDate), 'yyyy/MM/dd (EEE)', { locale: ja })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Assignees */}
                    {assignees.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                                <User className="w-4 h-4" /> Assignees
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {assignees.map((u: any) => (
                                    <div key={u.id} className="flex items-center gap-2 bg-zinc-800 rounded-full pl-1 pr-3 py-1 border border-zinc-700">
                                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                                            {(u.nickname?.[0] || u.name?.[0] || "?").toUpperCase()}
                                        </div>
                                        <span className="text-xs text-zinc-200">{u.nickname || u.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Attachments (Placeholder compatible) */}
                    {(task.attachments?.length ?? 0) > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                                <LinkIcon className="w-4 h-4" /> Attachments
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {task.attachments!.map((att, i) => (
                                    <a 
                                        key={i} 
                                        href={att.webViewLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group border border-white/5"
                                    >
                                        <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-white">
                                            📄
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-zinc-300 truncate">{att.name}</div>
                                            <div className="text-[10px] text-zinc-500 truncate">{att.mimeType}</div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
