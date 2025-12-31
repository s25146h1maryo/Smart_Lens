"use client";

import { useState } from "react";
import { Thread, Task, UserRole, DriveFile } from "@/types";
import styles from "./thread.module.css";
import Link from "next/link";

import TaskBoard from "./TaskBoard";
import SidebarTaskCreator from "./SidebarTaskCreator";
import ArchivedTasksModal from "./ArchivedTasksList";
import ThreadSettingsModal from "./ThreadSettingsModal";
import { Settings, ExternalLink, Archive } from "lucide-react";

// Re-define User interface locally to match what page.tsx passes or import from SidebarTaskCreator if exported
// Ideally we should export it from types or user actions, but for now copying is safe
export interface UIUser {
    id: string;
    name: string;
    image?: string;
    nickname?: string;
}

interface ThreadViewProps {
    thread: Thread;
    initialTasks: Task[];
    users: UIUser[];
    currentUserRole?: string;
    files: DriveFile[];
}

export default function ThreadView({ thread, initialTasks, users, currentUserRole, files }: ThreadViewProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showArchivedModal, setShowArchivedModal] = useState(false);

    const handleTaskCreated = (newTask: Task) => {
        setTasks(prev => [newTask, ...prev]);
    };

    const isEditor = currentUserRole === "ROOT" || currentUserRole === "ADMIN" || currentUserRole === "TEACHER";

    const archivedTasks = tasks.filter(t => t.status === "archived");
    const activeTasks = tasks.filter(t => t.status !== "archived");

    return (
        <div className="flex flex-col h-full bg-[#050510] text-white">
            {/* Header Section */}
            <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-500/20">
                        {thread.title[0]}
                     </div>
                     <div>
                        <h1 className="text-2xl font-bold tracking-tight">{thread.title}</h1>
                        <p className="text-sm text-zinc-400 mt-0.5 line-clamp-1 max-w-md">
                            {thread.description || "説明なし"}
                        </p>
                     </div>
                </div>

                <div className="flex items-center gap-3">
                     {/* Settings Trigger */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            {/* Main Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                
                {/* Top Section: Quick Actions / Metrics / Description */}
                {/* Maybe 2 columns: TaskCreator (Left) vs Stats (Right)? Or TaskCreator (Top)? */}
                
                <section className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Left: Task Creator Card */}
                    <div className="xl:col-span-1">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 sticky top-8">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">クイックアクション (タスク作成)</h3>
                            <SidebarTaskCreator threadId={thread.id} users={users} onTaskCreated={handleTaskCreated} />
                            
                            <button 
                                onClick={() => setShowArchivedModal(true)}
                                className="w-full mt-6 h-20 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-purple-400 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                    <Archive size={16} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold">完全完了タスク</span>
                                    <span className="text-[10px] opacity-60">{archivedTasks.length}件のアーカイブ</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <ArchivedTasksModal 
                        isOpen={showArchivedModal}
                        onClose={() => setShowArchivedModal(false)}
                        tasks={archivedTasks}
                        threadId={thread.id}
                    />

                    {/* Right: Task Board & Files */}
                    <div className="xl:col-span-3 space-y-8">
                         {/* File List Mini View */}


                         {/* Task Board */}
                         <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">タスク</h2>
                                {/* Filter controls? */}
                            </div>

                            <TaskBoard tasks={activeTasks} setTasks={setTasks} threadId={thread.id} users={users} />
                         </div>
                    </div>
                </section>
            </div>

            {isSettingsOpen && (
                <ThreadSettingsModal 
                    thread={thread} 
                    users={users} 
                    currentUserRole={currentUserRole} 
                    onClose={() => setIsSettingsOpen(false)} 
                />
            )}
        </div>
    );
}
