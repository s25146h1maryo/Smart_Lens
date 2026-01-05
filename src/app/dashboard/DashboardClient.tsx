"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { format, isAfter, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { useRoomStatus } from "@/hooks/useRoomStatus";
import { useChatUpload } from "@/app/messages/ChatUploadContext";
import { createTask, updateTaskStatus } from "@/app/actions/task";
import { Task } from "@/types";
import EditTaskModal from "@/app/components/EditTaskModal";
import { 
    X, Plus, Calendar, Search, Check, Flag, Clock,
    Paperclip, FileIcon, Loader2, ChevronRight, AlertCircle,
    CheckCircle2, Briefcase, ArrowRight, TrendingUp, Users, MessageSquare, Zap, User, Globe
} from "lucide-react";
import UnifiedHeader from "@/components/UnifiedHeader";
import CreateThreadModal from "./CreateThreadModal";
import { useSearchParams } from "next/navigation";

// KPI Drill-down types
type DrillDownType = 'todayDue' | 'pending' | 'overallComplete' | 'myComplete' | 'unread' | null;

interface DashboardStats {
    pendingTaskCount: number;
    todayDueTaskCount: number;
    todayEventCount: number;
    myTodoCount: number;
    myInProgressCount: number;
    myDoneCount: number;
    activeThreadCount: number;
    unreadMessageCount: number;
    attendanceUntil1645: number;
    attendanceUntil1900: number;
    isRoomOpen: boolean;
}

interface TaskItem {
    id: string;
    title: string;
    threadId: string;
    threadTitle?: string;
    dueDate?: number | null;
    startDate?: number | null;
    endDate?: number | null;
    priority: string;
    status: string;
    assigneeIds?: string[];
}

interface RecentThread {
    id: string;
    title: string;
    description?: string;
    updatedAt: number;
}

interface DashboardClientProps {
    // Optional props for initial SSR (if any), but we mainly fetch client side now
    stats?: DashboardStats;
    highPriorityTasks?: TaskItem[];
    myTasks?: {
        todoCount: number;
        inProgressCount: number;
        doneCount: number;
        tasks: TaskItem[];
    };
    recentThreads?: RecentThread[];
    todayAttendees?: {
        until1645: { id: string; name: string }[];
        until1900: { id: string; name: string }[];
        noST: { id: string; name: string }[];
        home: { id: string; name: string }[];
    };
    currentUser?: { id: string; name: string; email: string };
    threads?: { id: string; title: string }[];
    users?: any[];
    overallCompletion?: number;
    myCompletion?: number;
    allTasks?: TaskItem[];
}

import { getDashboardData } from "@/app/actions/dashboard";
import { useSession } from "next-auth/react";

export default function DashboardClient(props: DashboardClientProps) {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(!props.stats);
    const [data, setData] = useState<DashboardClientProps>(props);

    useEffect(() => {
        const fetchData = async () => {
            if (session?.user?.id && !props.stats) {
                try {
                    const res = await getDashboardData();
                    setData({
                        ...res,
                        currentUser: { 
                            id: session.user.id, 
                            name: session.user.name || 'User', 
                            email: session.user.email || '' 
                        }
                    });
                } catch (e) {
                    console.error("Failed to fetch dashboard data", e);
                } finally {
                    setIsLoading(false);
                }
            } else if (props.stats) {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [session, props.stats]);

    // Destructure from data state instead of direct props
    const {
        stats,
        highPriorityTasks = [],
        myTasks = { todoCount: 0, inProgressCount: 0, doneCount: 0, tasks: [] },
        recentThreads = [],
        todayAttendees = { until1645: [], until1900: [], noST: [], home: [] },
        currentUser,
        threads = [],
        users = [],
        overallCompletion = 0,
        myCompletion = 0,
        allTasks = []
    } = data || {};

    // Filter mode: 'mine' = my assigned only, 'all' = everyone's tasks
    const [filterMode, setFilterMode] = useState<'mine' | 'all'>('mine');
    
    // KPI Drill-down modal
    const [activeDrillDown, setActiveDrillDown] = useState<DrillDownType>(null);
    
    // Fix for Hydration Mismatch (Timezone differences, etc.)
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);



    
    // Mobile Active Tab
    const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'menu'>('home');

    // Room status toggle
    const { current: roomCurrent, toggleStatus } = useRoomStatus();
    const isRoomOpen = roomCurrent?.isOpen ?? stats?.isRoomOpen ?? false;

    // Edit task modal
    const [editingTask, setEditingTask] = useState<(Task & { threadTitle?: string }) | null>(null);

    // New task modal
    const [showNewTask, setShowNewTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskThread, setNewTaskThread] = useState(threads[0]?.id || "");
    const [newTaskDate, setNewTaskDate] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
    const [newTaskAssigneeSearch, setNewTaskAssigneeSearch] = useState("");
    const [newTaskAttachments, setNewTaskAttachments] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [uploadingCount, setUploadingCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile } = useChatUpload();

    const today = startOfDay(new Date());
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const todayStr = format(new Date(), "M月d日 (E)", { locale: ja });

    // Combine all available tasks for filtering
    const combinedTasks = useMemo(() => {
        // If allTasks provided, use it. Otherwise combine highPriority + myTasks.tasks
        if (allTasks.length > 0) return allTasks;
        
        // Dedupe by id
        const map = new Map<string, TaskItem>();
        highPriorityTasks.forEach(t => map.set(t.id, t));
        myTasks.tasks.forEach(t => map.set(t.id, t));
        return Array.from(map.values());
    }, [allTasks, highPriorityTasks, myTasks.tasks]);

    // Filter tasks based on mode
    const filterByMode = (tasks: TaskItem[]) => {
        if (filterMode === 'mine') {
            return tasks.filter(t => t.assigneeIds?.includes(currentUser?.id || ''));
        }
        return tasks;
    };

    // Computed filtered data
    const filteredHighPriorityTasks = useMemo(() => {
        if (!currentUser) return [];
        return filterByMode(highPriorityTasks);
    }, [highPriorityTasks, filterMode, currentUser?.id]);

    const filteredMyTasks = useMemo(() => {
        // myTasks already filtered by server, but apply mode for consistency
        if (filterMode === 'all') {
            // Show all incomplete tasks
            return combinedTasks.filter(t => t.status !== 'done');
        }
        return myTasks.tasks;
    }, [myTasks.tasks, combinedTasks, filterMode]);

    // Compute filtered stats
    const filteredStats = useMemo(() => {
        if (!currentUser && filterMode === 'mine') {
             return { pending: 0, todayDue: 0, completion: 0, done: 0, total: 0 };
        }
        const baseTasks = filterMode === 'mine' 
            ? combinedTasks.filter(t => t.assigneeIds?.includes(currentUser?.id || ''))
            : combinedTasks;
        
        const pendingCount = baseTasks.filter(t => t.status !== 'done').length;
        const doneCount = baseTasks.filter(t => t.status === 'done').length;
        const totalCount = baseTasks.length;
        const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        
        const todayDueCount = baseTasks.filter(t => {
            if (t.status === 'done') return false;
            const d = t.dueDate || t.startDate;
            return d && d >= todayStart && d <= todayEnd;
        }).length;

        return {
            pending: pendingCount,
            todayDue: todayDueCount,
            completion: completionRate,
            done: doneCount,
            total: totalCount
        };
    }, [combinedTasks, filterMode, currentUser?.id, todayStart, todayEnd]);

    // Drill-down task list
    const drillDownTasks = useMemo(() => {
        if (!activeDrillDown) return [];
        if (!currentUser && filterMode === 'mine') return [];

        const baseTasks = filterMode === 'mine'
            ? combinedTasks.filter(t => t.assigneeIds?.includes(currentUser?.id || ''))
            : combinedTasks;
        
        switch (activeDrillDown) {
            case 'todayDue':
                return baseTasks.filter(t => {
                    if (t.status === 'done') return false;
                    const d = t.dueDate || t.startDate;
                    return d && d >= todayStart && d <= todayEnd;
                });
            case 'pending':
                return baseTasks.filter(t => t.status !== 'done');
            case 'overallComplete':
            case 'myComplete':
                return baseTasks.filter(t => t.status === 'done');
            default:
                return [];
        }
    }, [activeDrillDown, combinedTasks, filterMode, currentUser?.id, todayStart, todayEnd]);

    const drillDownTitle = useMemo(() => {
        switch (activeDrillDown) {
            case 'todayDue': return '今日の締切';
            case 'pending': return '未完了タスク';
            case 'overallComplete':
            case 'myComplete': return '完了済みタスク';
            default: return '';
        }
    }, [activeDrillDown]);

    const handleRoomToggle = async () => {
        if (!currentUser) return;
        await toggleStatus(currentUser.id, currentUser.name, !isRoomOpen);
    };

    const handleTaskClick = (task: TaskItem) => {
        setEditingTask({
            id: task.id,
            threadId: task.threadId,
            title: task.title,
            status: task.status as Task['status'],
            priority: task.priority as Task['priority'],
            dueDate: task.dueDate,
            startDate: task.startDate,
            endDate: task.endDate,
            assigneeIds: task.assigneeIds || [],
            attachments: [],
            createdAt: Date.now(),
        });
    };

    const handleQuickStatusChange = async (task: TaskItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextStatus: Record<Task['status'], Task['status']> = {
            'todo': 'in-progress',
            'in-progress': 'done',
            'done': 'todo',
            'archived': 'archived' // Archived tasks don't change status in quick toggle
        };
        const newStatus = nextStatus[task.status as Task['status']];
        await updateTaskStatus(task.id, task.threadId, newStatus);
    };

    const isOverdue = (task: TaskItem) => {
        if (task.status === 'done') return false;
        const dueDate = task.dueDate || task.endDate;
        if (!dueDate) return false;
        return isAfter(today, new Date(dueDate));
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
        }
    };

    const getStatusIcon = (s: string) => {
        switch (s) {
            case 'todo': return <Clock size={14} className="text-zinc-500" />;
            case 'in-progress': return <AlertCircle size={14} className="text-amber-500" />;
            case 'done': return <CheckCircle2 size={14} className="text-emerald-500" />;
            default: return <Clock size={14} className="text-zinc-500" />;
        }
    };

    const handleNewTaskSubmit = async () => {
        if (!newTaskTitle.trim() || !newTaskThread || !newTaskDate) return;
        setIsSubmitting(true);
        try {
            const attachments = newTaskAttachments.map(a => ({
                name: a.name,
                driveFileId: a.driveFileId || a.id,
                mimeType: a.mimeType || a.type,
                webViewLink: a.webViewLink || a.url
            }));
            await createTask(newTaskThread, newTaskTitle, 'todo', {
                priority: newTaskPriority,
                assigneeIds: newTaskAssignees,
                dueDate: new Date(newTaskDate).getTime(),
                startDate: new Date(newTaskDate).getTime(),
                endDate: new Date(newTaskDate).getTime(),
                attachments
            });
            setNewTaskTitle("");
            setNewTaskDate("");
            setNewTaskAssignees(currentUser?.id ? [currentUser.id] : []);
            setNewTaskPriority("medium");
            setNewTaskAttachments([]);
            setShowNewTask(false);
        } catch (e) {
            console.error(e);
            alert("タスクの作成に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Attachment Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setUploadingCount(prev => prev + files.length);
            
            files.forEach(file => {
                uploadFile(
                    file, 
                    { threadId: newTaskThread }, // Use thread context for new task uploads
                    (attachment) => {
                        setNewTaskAttachments(prev => [...prev, {
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
        setNewTaskAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const filteredUsers = users.filter(u => 
        (u.nickname || u.name || "").toLowerCase().includes(newTaskAssigneeSearch.toLowerCase())
    );

    // Task Card Component
    const TaskCard = ({ task }: { task: TaskItem }) => (
        <div 
            onClick={() => handleTaskClick(task)}
            className={`
                group relative bg-zinc-950/50 border rounded-2xl p-3 transition-all cursor-pointer
                hover:bg-zinc-900/70 hover:shadow-xl hover:-translate-y-0.5 hover:scale-[1.01]
                ${isOverdue(task) ? 'border-red-500/40 bg-red-950/20' : 'border-white/5 hover:border-white/10'}
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/40 text-zinc-400 border border-white/5 max-w-[60%] truncate">
                    <Briefcase size={8} />
                    <span className="truncate">{task.threadTitle || 'Unknown'}</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                    {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                </span>
            </div>

            <div className="flex items-start gap-2">
                <button
                    onClick={(e) => handleQuickStatusChange(task, e)}
                    className="mt-0.5 p-1 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    title="ステータス変更"
                >
                    {getStatusIcon(task.status)}
                </button>
                
                <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-bold leading-snug ${task.status === 'done' ? 'text-zinc-500 line-through decoration-zinc-700' : 'text-zinc-100'}`}>
                        {task.title}
                        {isOverdue(task) && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[8px] font-bold text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-500/20 align-middle no-underline">
                                <AlertCircle size={8} /> 期限切れ
                            </span>
                        )}
                    </h3>
                    
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        {(task.dueDate || task.startDate) && (
                            <span className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-400' : 'text-zinc-400'}`}>
                                <Calendar size={10} />
                                {format(task.dueDate || task.startDate!, "M/d", { locale: ja })}
                            </span>
                        )}
                        {task.assigneeIds && task.assigneeIds.length > 0 && (
                            <div className="flex -space-x-1">
                                {task.assigneeIds.slice(0, 3).map((uid, i) => {
                                    const u = users.find(u => u.id === uid || u.uid === uid);
                                    return (
                                        <div key={uid} className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[7px] text-zinc-300" title={u?.name}>
                                            {u?.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    );
                                })}
                                {task.assigneeIds.length > 3 && (
                                    <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[7px] text-zinc-500">
                                        +{task.assigneeIds.length - 3}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Compact Task Row for Drill-down
    const TaskRow = ({ task }: { task: TaskItem }) => (
        <div 
            onClick={() => { setActiveDrillDown(null); handleTaskClick(task); }}
            className={`
                p-3 bg-zinc-950/50 border rounded-xl transition-all cursor-pointer
                hover:bg-indigo-500/10 hover:border-indigo-500/30
                ${isOverdue(task) ? 'border-red-500/30' : 'border-white/5'}
            `}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-sm text-zinc-200 truncate pr-4">{task.title}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                    task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    task.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                    'bg-zinc-800 text-zinc-500 border-white/5'
                }`}>{task.status === 'in-progress' ? '進行中' : task.status === 'todo' ? '未着手' : '完了'}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                <div className="flex items-center gap-1 text-zinc-400">
                    <Briefcase size={10} />
                    {task.threadTitle}
                </div>
                {(task.dueDate || task.startDate) && (
                    <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-400' : ''}`}>
                        <Calendar size={10} />
                        {format(task.dueDate || task.startDate!, "yyyy/M/d")}
                    </div>
                )}
            </div>
        </div>
    );

    const totalAttendees = todayAttendees.until1645.length + todayAttendees.until1900.length;

    // Mounted check moved to end to prevent Hook Rule violation (Rendered fewer hooks)
    if (!mounted || isLoading || !stats || !currentUser) {
        return (
            <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#050508] text-zinc-100 overflow-hidden font-sans flex flex-col">
            {/* Background Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[180px]"></div>
                <div className="absolute bottom-[-200px] left-[-100px] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[180px]"></div>
            </div>

            <div 
                className="relative z-10 flex flex-col h-full px-4 pb-4 max-w-[1920px] mx-auto w-full gap-3 overflow-hidden"
                style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
            >
                
                {/* Header - Hidden on Mobile, shown on Desktop */}
                <div className="hidden lg:block">
                    <UnifiedHeader
                        title="Dashboard"
                        leftChildren={
                            <>
                                <span className="text-sm text-zinc-500 font-medium">{todayStr}</span>
                                
                                {/* Filter Toggle */}
                                <div className="flex bg-zinc-900/70 rounded-xl p-1 border border-white/5">
                                    <button 
                                        onClick={() => setFilterMode('mine')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'mine' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <User size={12} /> 自分のみ
                                    </button>
                                    <button 
                                        onClick={() => setFilterMode('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <Globe size={12} /> 全体
                                    </button>
                                </div>

                                <button 
                                    onClick={handleRoomToggle}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg ${isRoomOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10' : 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-red-500/10'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${isRoomOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                                    {isRoomOpen ? '開室中' : '閉室中'}
                                </button>
                            </>
                        }
                        user={currentUser}
                        className="flex-shrink-0"
                    >
                        <Link href="/todo" className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 hover:border-indigo-400/50 transition-all text-sm text-indigo-300 font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/10">
                            📋 GlobalTodo <ArrowRight size={14}/>
                        </Link>
                    </UnifiedHeader>
                </div>

                {/* Mobile Header - Minimal */}
                <div className="flex lg:hidden items-center justify-between p-1 mb-1">
                    <div className="flex items-center gap-2 pl-10">
                        <span className="text-xs text-zinc-500 font-medium">{todayStr}</span>
                        <button 
                            onClick={handleRoomToggle}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${isRoomOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRoomOpen ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                            {isRoomOpen ? '開室' : '閉室'}
                        </button>
                        <div className="flex bg-zinc-900/70 rounded-lg p-0.5 border border-white/5">
                            <button 
                                onClick={() => setFilterMode('mine')}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${filterMode === 'mine' ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}
                            >
                                <User size={10} /> 自分
                            </button>
                            <button 
                                onClick={() => setFilterMode('all')}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${filterMode === 'all' ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}
                            >
                                <Globe size={10} /> 全体
                            </button>
                        </div>
                    </div>
                    <Link href="/todo" className="px-2 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-[10px] text-indigo-300 font-bold flex items-center gap-1">
                        📋 Todo <ArrowRight size={10}/>
                    </Link>
                </div>

                {/* Mobile Tab Navigation - Sleek Bottom Bar styling or better Top Tabs */}
                <div className="flex lg:hidden bg-zinc-950/80 backdrop-blur-xl p-1 rounded-2xl border border-white/10 mb-4 shrink-0 shadow-lg sticky top-0 z-50">
                    {(['home', 'tasks', 'menu'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); }}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg transform scale-100' : 'text-zinc-500 hover:text-zinc-300 scale-95'}`}
                        >
                            {tab === 'home' && <span className="text-lg">🏠</span>}
                            {tab === 'tasks' && <span className="text-lg">📋</span>}
                            {tab === 'menu' && <span className="text-lg">📊</span>}
                            <span className={activeTab === tab ? 'block' : 'hidden'}>
                                {tab === 'home' && 'ホーム'}
                                {tab === 'tasks' && 'タスク'}
                                {tab === 'menu' && 'メニュー'}
                            </span>
                        </button>
                    ))}
                </div>

                {/* KPI Section */}
                {/* Mobile: Carousel (Home Tab Only), Desktop: Grid (Always) */}
                <div className={`
                    ${activeTab === 'home' ? 'grid' : 'hidden'} 
                    grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0 
                    /* No overflow, no snap, just grid */
                `}>
                    {/* Today Due */}
                    <button 
                        onClick={() => setActiveDrillDown('todayDue')}
                        className="w-full bg-gradient-to-br from-violet-600/20 to-violet-900/10 border border-violet-500/20 rounded-2xl p-4 backdrop-blur-sm text-left hover:border-violet-400/40 hover:scale-[1.02] transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                <Zap className="text-violet-400" size={18} />
                            </div>
                            <span className="text-xs text-violet-300 font-bold uppercase tracking-wide">今日の締切</span>
                        </div>
                        <div className="text-3xl font-black text-white">{filteredStats.todayDue}</div>
                        <div className="text-[10px] text-violet-400/70 mt-1">件のタスク</div>
                    </button>

                    {/* Pending */}
                    <button 
                        onClick={() => setActiveDrillDown('pending')}
                        className="w-full bg-gradient-to-br from-cyan-600/20 to-cyan-900/10 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-sm text-left hover:border-cyan-400/40 hover:scale-[1.02] transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                <Clock className="text-cyan-400" size={18} />
                            </div>
                            <span className="text-xs text-cyan-300 font-bold uppercase tracking-wide">未完了</span>
                        </div>
                        <div className="text-3xl font-black text-white">{filteredStats.pending}</div>
                        <div className="text-[10px] text-cyan-400/70 mt-1">件待ち</div>
                    </button>

                    {/* Overall Completion */}
                    <button 
                        onClick={() => setActiveDrillDown('overallComplete')}
                        className="w-full bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-sm text-left hover:border-emerald-400/40 hover:scale-[1.02] transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <TrendingUp className="text-emerald-400" size={18} />
                            </div>
                            <span className="text-xs text-emerald-300 font-bold uppercase tracking-wide">{filterMode === 'mine' ? '自分完了率' : '全体完了率'}</span>
                        </div>
                        <div className="text-3xl font-black text-white">{filteredStats.completion}%</div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all" style={{ width: `${filteredStats.completion}%` }}></div>
                        </div>
                    </button>

                    {/* Tasks Done */}
                    <button 
                        onClick={() => setActiveDrillDown('myComplete')}
                        className="w-full bg-gradient-to-br from-amber-600/20 to-amber-900/10 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-sm text-left hover:border-amber-400/40 hover:scale-[1.02] transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <CheckCircle2 className="text-amber-400" size={18} />
                            </div>
                            <span className="text-xs text-amber-300 font-bold uppercase tracking-wide">完了数</span>
                        </div>
                        <div className="text-3xl font-black text-white">{filteredStats.done}</div>
                        <div className="text-[10px] text-amber-400/70 mt-1">/ {filteredStats.total} 件</div>
                    </button>

                    {/* Unread Messages - Clickable */}
                    <Link 
                        href="/messages"
                        className="w-full bg-gradient-to-br from-rose-600/20 to-rose-900/10 border border-rose-500/20 rounded-2xl p-4 backdrop-blur-sm text-left hover:border-rose-400/40 hover:scale-[1.02] transition-all block"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center">
                                <MessageSquare className="text-rose-400" size={18} />
                            </div>
                            <span className="text-xs text-rose-300 font-bold uppercase tracking-wide">未読</span>
                        </div>
                        <div className="text-3xl font-black text-white">{stats.unreadMessageCount}</div>
                        <div className="text-[10px] text-rose-400/70 mt-1">件のメッセージ</div>
                    </Link>
                </div>

                {/* Main Grid */}
                <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-3 min-h-0 overflow-y-auto lg:overflow-hidden">
                    
                    {/* LEFT: Task Panels (8 cols) - Visible on 'tasks' tab OR desktop */}
                    <div className={`${activeTab === 'tasks' ? 'flex' : 'hidden'} lg:flex lg:col-span-8 w-full flex-col gap-3 min-h-0 pb-20 lg:pb-0`}>
                        
                        {/* High Priority */}
                        <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col overflow-hidden backdrop-blur-sm min-h-[300px]">
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 rounded-full bg-red-500"></div>
                                    <h2 className="text-sm font-black text-white">⚡ 優先度: 高</h2>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full font-bold">{filteredHighPriorityTasks.length}件</span>
                                </div>
                                <Link href="/todo?priority=high" className="text-[10px] text-zinc-500 hover:text-indigo-400 flex items-center gap-0.5 font-medium">すべて <ChevronRight size={12}/></Link>
                            </div>
                            <div className="flex-1 overflow-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 content-start custom-scrollbar">
                                {filteredHighPriorityTasks.length > 0 ? filteredHighPriorityTasks.map(task => (
                                    <TaskCard key={task.id} task={task} />
                                )) : (
                                    <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                                        <span className="text-3xl mb-2">🎉</span>
                                        <span className="text-zinc-500 text-sm font-medium">
                                            {filterMode === 'mine' ? '担当の優先タスクなし' : '優先タスクなし'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* My Tasks / All Tasks */}
                        <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col overflow-hidden backdrop-blur-sm min-h-[300px]">
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-black text-white">📋 {filterMode === 'mine' ? 'マイタスク' : '全タスク'}</h2>
                                    <div className="flex gap-1">
                                        <span className="px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 text-[10px] font-bold">{filterMode === 'mine' ? myTasks.todoCount : filteredMyTasks.filter(t => t.status === 'todo').length}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{filterMode === 'mine' ? myTasks.inProgressCount : filteredMyTasks.filter(t => t.status === 'in-progress').length}</span>
                                    </div>
                                </div>
                                <Link href="/todo" className="text-[10px] text-zinc-500 hover:text-indigo-400 flex items-center gap-0.5 font-medium">すべて <ChevronRight size={12}/></Link>
                            </div>
                            <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start custom-scrollbar">
                                {filteredMyTasks.length > 0 ? filteredMyTasks.slice(0, 9).map(task => (
                                    <TaskCard key={task.id} task={task} />
                                )) : (
                                    <div className="col-span-full flex items-center justify-center text-zinc-500 text-sm py-8 font-medium">
                                        {filterMode === 'mine' ? '担当タスクなし' : 'タスクなし'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Sidebar (4 cols) - Visible on 'menu' (Home) tab? No, let's put it in 'menu' tab OR 'home' tab? 
                        The plan said: "Home/Overview" -> KPI + Quick Nav + Activity. 
                        "Tasks" -> Task Lists.
                        "Activity" -> Attendance etc.
                        Let's map:
                        'home' -> KPI + Quick Nav + (maybe truncated Activity)
                        'tasks' -> Task Lists
                        'menu' -> Full Activity + Attendance + Recent Threads
                        
                        Wait, in the simple tab structure I coded above: 'home', 'tasks', 'menu'.
                        Let's put Sidebar content in 'menu' (or 'activity').
                    */}
                    <div className={`${activeTab === 'menu' || activeTab === 'home' ? 'flex' : 'hidden'} lg:flex lg:col-span-4 w-full flex-col gap-3 min-h-0 pb-20 lg:pb-0`}>
                        
                        {/* Quick Nav - Show on Home on Mobile */}
                        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} lg:block grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0`}>
                             <Link href="/calendar" className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center gap-1 text-center group">
                                <span className="text-lg group-hover:scale-110 transition-transform">📅</span>
                                <span className="text-[9px] text-zinc-500 font-medium">カレンダー</span>
                            </Link>
                            {/* ... (Other links unchanged but hidden in replace block, need to reconstruct) 
                                WAIT, I am replacing the entire block. I must include all Quick Nav content.
                            */}
                            <Link href="/drive" className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-1 text-center group">
                                <span className="text-lg group-hover:scale-110 transition-transform">📁</span>
                                <span className="text-[9px] text-zinc-500 font-medium">ドライブ</span>
                            </Link>
                            <Link href="/messages" className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all flex flex-col items-center justify-center gap-1 text-center group relative">
                                <span className="text-lg group-hover:scale-110 transition-transform">💬</span>
                                <span className="text-[9px] text-zinc-500 font-medium">メッセージ</span>
                                {stats.unreadMessageCount > 0 && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>}
                            </Link>
                            <Link href="/threads" className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-1 text-center group">
                                <span className="text-lg group-hover:scale-110 transition-transform">📂</span>
                                <span className="text-[9px] text-zinc-500 font-medium">スレッド</span>
                            </Link>
                        </div>

                        {/* Today's Attendance - Show on Menu on Mobile */}
                        {/* Logic: if mobile & home -> show Quick Nav only? 
                           If mobile & menu -> show Attendance, Recent Threads, New Task?
                           Desktop -> Show all.
                           
                           My condition above: `${activeTab === 'menu' || activeTab === 'home' ? 'flex' : 'hidden'}`
                           I need to hide specific children based on tab.
                        */}
                        
                        <div className={`${activeTab === 'menu' ? 'flex' : 'hidden'} lg:flex flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex-col overflow-hidden backdrop-blur-sm`}>
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Users className="text-indigo-400" size={16} />
                                    <h2 className="text-sm font-black text-white">本日の出席</h2>
                                    <span className="text-[10px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full font-bold">{totalAttendees}人</span>
                                </div>
                                <Link href="/attendance" className="text-[10px] text-zinc-500 hover:text-indigo-400 font-medium">詳細 →</Link>
                            </div>
                            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar">
                                {todayAttendees.until1900.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-indigo-400 mb-1.5">19:00まで</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {todayAttendees.until1900.map(u => (
                                                <span key={u.id} className="px-2 py-1 text-[10px] bg-indigo-500/20 text-indigo-300 rounded-lg font-medium">{u.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {todayAttendees.until1645.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-blue-400 mb-1.5">16:45まで</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {todayAttendees.until1645.map(u => (
                                                <span key={u.id} className="px-2 py-1 text-[10px] bg-blue-500/20 text-blue-300 rounded-lg font-medium">{u.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {todayAttendees.noST.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-yellow-400 mb-1.5">校内不参加</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {todayAttendees.noST.map(u => (
                                                <span key={u.id} className="px-2 py-1 text-[10px] bg-yellow-500/20 text-yellow-300 rounded-lg font-medium">{u.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {totalAttendees === 0 && todayAttendees.noST.length === 0 && (
                                    <div className="flex items-center justify-center text-zinc-600 text-xs py-8">データなし</div>
                                )}
                            </div>
                        </div>

                        {/* Recent Threads - Show on Menu */}
                        <div className={`${activeTab === 'menu' ? 'block' : 'hidden'} lg:block bg-zinc-900/50 border border-white/5 rounded-2xl p-4 backdrop-blur-sm`}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-black text-white flex items-center gap-2">🔗 最近アクセス</h2>
                                <Link href="/threads" className="text-[10px] text-zinc-500 hover:text-indigo-400 font-medium">すべて →</Link>
                            </div>
                            <div className="space-y-1.5">
                                {recentThreads.slice(0, 4).map(thread => (
                                    <Link href={`/thread/${thread.id}`} key={thread.id} className="block p-2.5 rounded-xl bg-white/5 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all">
                                        <div className="text-xs font-bold text-indigo-300 truncate">{thread.title}</div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* New Task Button - Show on Home & Menu */}
                {/* ... existing new task button logic likely follows ... */}
            </div>
                </div>{/* End Main Grid (Inner) */}
            </div>{/* End Outer Main Grid */ }

            {/* Create Thread Modal - Controlled by URL param */}
            {searchParams.get('create') === 'true' && <CreateThreadModal />}



            {/* KPI Drill-down Modal */}
            {activeDrillDown && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setActiveDrillDown(null)}>
                    <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Zap size={20} className="text-indigo-400" />
                                {drillDownTitle} ({drillDownTasks.length}件)
                            </h3>
                            <button onClick={() => setActiveDrillDown(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {drillDownTasks.map(t => (
                                <TaskRow key={t.id} task={t} />
                            ))}
                            {drillDownTasks.length === 0 && (
                                <div className="text-center py-10 text-zinc-600">タスクはありません</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {editingTask && (
                <EditTaskModal
                    task={editingTask as Task}
                    isOpen={!!editingTask}
                    onClose={() => setEditingTask(null)}
                    users={users}
                />
            )}

            {/* New Task Modal */}
            {showNewTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0B] shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4 bg-white/5">
                            <h2 className="font-black text-base text-zinc-100">新規タスク</h2>
                            <button onClick={() => setShowNewTask(false)} className="p-1.5 text-zinc-400 hover:bg-white/10 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 block">タイトル</label>
                                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="タスク名を入力" className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 block">スレッド</label>
                                    <select value={newTaskThread} onChange={e => setNewTaskThread(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer">
                                        {threads.map(t => <option key={t.id} value={t.id} className="bg-zinc-900">{t.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 block">期限</label>
                                    <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none [color-scheme:dark]"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 block">優先度</label>
                                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/10">
                                    {(['low', 'medium', 'high'] as const).map(p => (
                                        <button key={p} onClick={() => setNewTaskPriority(p)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg uppercase transition-all ${newTaskPriority === p ? (p === 'high' ? 'bg-red-500/20 text-red-400' : p === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400') : 'text-zinc-500 hover:text-zinc-300'}`}>
                                            {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 block">担当者</label>
                                <div className="border border-white/10 rounded-xl bg-zinc-900/30 overflow-hidden">
                                    <div className="p-3 border-b border-white/5 flex items-center gap-2">
                                        <Search size={12} className="text-zinc-500"/>
                                        <input placeholder="検索..." value={newTaskAssigneeSearch} onChange={e => setNewTaskAssigneeSearch(e.target.value)} className="bg-transparent text-xs text-white outline-none flex-1 placeholder-zinc-600"/>
                                    </div>
                                    <div className="max-h-28 overflow-y-auto p-1.5 space-y-1">
                                        {filteredUsers.map(u => {
                                            const uid = u.id || u.uid;
                                            const isSelected = newTaskAssignees.includes(uid);
                                            return (
                                                <button key={uid} onClick={() => setNewTaskAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])} className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}>
                                                    <span className="text-xs text-zinc-300">{u.nickname || u.name}</span>
                                                    {isSelected && <Check size={12} className="text-indigo-400"/>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Attachments */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 flex items-center gap-2">
                                    <Paperclip size={12}/> 添付ファイル
                                </label>
                                
                                {newTaskAttachments.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {newTaskAttachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:bg-white/5 transition-colors group">
                                                <a href={file.webViewLink || file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0">
                                                    <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                                        <FileIcon size={12} />
                                                    </div>
                                                    <div className="truncate text-xs text-zinc-300">{file.name}</div>
                                                </a>
                                                <button onClick={() => removeAttachment(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400"><X size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                                <button 
                                    onClick={() => {
                                        if (!newTaskThread) {
                                            alert("先にスレッドを選択してください");
                                            return;
                                        }
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-800/30 hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-all group"
                                >
                                    <Plus size={14} className="transition-transform group-hover:scale-110" />
                                    <span className="text-xs font-bold">ファイルを追加</span>
                                </button>
                            </div>
                        </div>
                        <div className="border-t border-white/5 p-4 bg-white/5 flex justify-end gap-3">
                            <button onClick={() => setShowNewTask(false)} className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-bold">キャンセル</button>
                            <button onClick={handleNewTaskSubmit} disabled={!newTaskTitle.trim() || !newTaskThread || !newTaskDate || isSubmitting || uploadingCount > 0} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                {(isSubmitting || uploadingCount > 0) ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} 
                                {uploadingCount > 0 ? "アップロード中..." : "作成"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
}
