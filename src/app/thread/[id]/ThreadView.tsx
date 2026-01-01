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
            {/* Header Section */}
            {/* Header Section */}
            <header className="relative px-6 md:px-8 py-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-[#050510]/80 backdrop-blur-xl sticky top-0 z-20 overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
                
                <div className="relative flex items-center gap-5 z-10 w-full md:w-auto pl-16 md:pl-0">
                     <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10 shrink-0">
                        {thread.title[0]}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1 truncate">{thread.title}</h1>
                        <div className="flex items-center gap-3 text-sm">
                            <p className="text-zinc-400 line-clamp-1 max-w-sm">
                                {thread.description || "説明なし"}
                            </p>
                            
                            {/* Member Facepile */}
                            {users && users.length > 0 && (
                                <div className="hidden md:flex items-center pl-3 border-l border-white/10 ml-1">
                                    <div className="flex -space-x-2">
                                        {users.slice(0, 4).map((user, i) => (
                                            <div key={user.id || i} className="w-6 h-6 rounded-full border border-[#050510] bg-zinc-800 flex items-center justify-center text-[10px] text-white" title={user.name}>
                                                {user.image ? (
                                                    <img src={user.image} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    (user.name?.[0] || "U").toUpperCase()
                                                )}
                                            </div>
                                        ))}
                                        {users.length > 4 && (
                                            <div className="w-6 h-6 rounded-full border border-[#050510] bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-400">
                                                +{users.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    <span className="ml-2 text-xs text-zinc-500">{users.length}名</span>
                                </div>
                            )}
                        </div>
                     </div>
                </div>

                <div className="relative flex items-center gap-3 mt-4 md:mt-0 self-end md:self-auto z-10">
                     {/* Settings Trigger */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5 transition-all active:scale-95"
                    >
                        <Settings size={20} />
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
