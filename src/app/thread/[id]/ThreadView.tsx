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
    const [isMobileTaskCreatorOpen, setIsMobileTaskCreatorOpen] = useState(false);

    const handleTaskCreated = (newTask: Task) => {
        setTasks(prev => [newTask, ...prev]);
    };

    const isEditor = currentUserRole === "ROOT" || currentUserRole === "ADMIN" || currentUserRole === "TEACHER";

    const archivedTasks = tasks.filter(t => t.status === "archived");
    const activeTasks = tasks.filter(t => t.status !== "archived");

    return (
        <div className="flex flex-col h-full bg-[#050510] text-white">
            {/* Header Section - Compact Mobile */}
            <header className="relative px-4 md:px-6 py-2 md:py-4 border-b border-white/5 flex items-center justify-between bg-[#050510]/80 backdrop-blur-xl sticky top-0 z-20 overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
                
                <div className="relative flex items-center gap-3 z-10 w-full md:w-auto pl-10 md:pl-0">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg md:text-2xl font-bold text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/10 shrink-0">
                        {thread.title[0]}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h1 className="text-lg md:text-2xl font-bold tracking-tight text-white leading-tight truncate">{thread.title}</h1>
                        {thread.description && (
                            <p className="text-zinc-500 text-[11px] md:text-sm line-clamp-1 max-w-xs md:max-w-sm">
                                {thread.description}
                            </p>
                        )}
                     </div>
                </div>

                <div className="relative flex items-center gap-2 md:gap-3 z-10 shrink-0">
                     {/* Settings Trigger */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-lg md:rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5 transition-all active:scale-95"
                    >
                        <Settings size={16} className="md:hidden"/>
                        <Settings size={20} className="hidden md:block"/>
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
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 xl:sticky xl:top-8 static">
                            <div className="flex items-center justify-between mb-4 xl:mb-4">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">クイックアクション (タスク作成)</h3>
                                <button 
                                    onClick={() => setIsMobileTaskCreatorOpen(!isMobileTaskCreatorOpen)}
                                    className="xl:hidden p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
                                >
                                    {isMobileTaskCreatorOpen ? <ExternalLink size={16} className="rotate-180" /> : <ExternalLink size={16} />}
                                </button>
                            </div>
                            
                            <div className={`${isMobileTaskCreatorOpen ? 'block' : 'hidden'} xl:block`}>
                                <SidebarTaskCreator threadId={thread.id} users={users} onTaskCreated={handleTaskCreated} />
                            </div>
                            
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
