"use client";

import { useState, useMemo, useRef } from "react";
import { TaskWithThread } from "@/app/actions/global_todo";
import { Task } from "@/types";
import { updateTaskStatus, createTask } from "@/app/actions/task";
import { getAvailableMembers } from "@/app/actions/global_todo";
import { format, isAfter, startOfDay, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { 
    Search, Filter, Calendar, AlertCircle, CheckCircle2, 
    Clock, BarChart3, UserCheck, Plus, X, ChevronRight,
    LayoutList, Kanban, SlidersHorizontal, ArrowUpDown, Layers,
    Briefcase, ChevronDown, Sparkles, User, Check, Paperclip, FileIcon
} from "lucide-react";
import EditTaskModal from "@/app/components/EditTaskModal";
import CalendarView from "./components/CalendarView";
import BoardView from "./components/BoardView";
import ReportModal from "./components/ReportModal";
import InsightsView from "./components/InsightsView";
import { useChatUpload } from "@/app/messages/ChatUploadContext";

interface GlobalTodoClientProps {
    initialTasks: TaskWithThread[];
    threads: { id: string; title: string }[];
    users: any[];
    workload: any;
    schoolEvents?: any[];
    currentUser: { id: string; name: string };
}

type ViewMode = 'list' | 'board' | 'workload' | 'calendar' | 'insights';
type GroupBy = 'none' | 'thread' | 'assignee' | 'priority' | 'status';
type SortBy = 'dueDate' | 'priority' | 'createdAt' | 'title';

export default function GlobalTodoClient({ 
    initialTasks, 
    threads, 
    users, 
    workload,
    schoolEvents = [],
    currentUser 
}: GlobalTodoClientProps) {
    // --- State ---
    const [tasks, setTasks] = useState(initialTasks);
    
    // View Controls
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [sortBy, setSortBy] = useState<SortBy>('createdAt');
    const [sortAsc, setSortAsc] = useState(false);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [showSchoolEvents, setShowSchoolEvents] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
    
    // Advanced Filter (Always visible or toggled - User wants 'visible without click' but we integrate it)
    // We will make the filter row persistent.
    const [dateRangeStart, setDateRangeStart] = useState("");
    const [dateRangeEnd, setDateRangeEnd] = useState("");

    // Availability Check state
    const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(false);
    const [availabilityDate, setAvailabilityDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [availableMembers, setAvailableMembers] = useState<{ id: string; name: string; taskCount: number }[]>([]);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

    // Modals
    const [showAddTask, setShowAddTask] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    // New Task State
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskThread, setNewTaskThread] = useState(threads[0]?.id || "");
    const [newTaskDateMode, setNewTaskDateMode] = useState<'point' | 'range' | 'scheduled'>('point');
    const [newTaskStartDate, setNewTaskStartDate] = useState("");
    const [newTaskEndDate, setNewTaskEndDate] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [newTaskAssigneeSearch, setNewTaskAssigneeSearch] = useState("");

    const [showValidationErrors, setShowValidationErrors] = useState(false);
    
    // Attachments
    const [newTaskAttachments, setNewTaskAttachments] = useState<any[]>([]);
    const { uploadFile } = useChatUpload();
    // Use an ID-based ref map or just a document query selector if inside a modal? 
    // Wait, the modal is simplified in this code block? No, it's inline in the render...
    // Let's check where the "Add Task" modal is. It's "showAddTask" state.
    // We need a ref for the file input.
    // Cannot simple use useRef inside loop/conditional easily, but here it's top level component.
    // However, we only need one reference as only one add modal is open.
    // But we need to define it at top level.
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Actually, useRef is better.
    // But I cannot add useRef in replace_file_content easily if I don't see the top.
    // I will add it here.
    
    // Re-declare to fix previous line comments which are not valid JS
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const isTaskFormValid = useMemo(() => {
        if (!newTaskTitle.trim()) return false;
        if (!newTaskStartDate) return false;
        if (newTaskDateMode === 'range' && !newTaskEndDate) return false;
        if (newTaskAssignees.length === 0) return false;
        return true;
    }, [newTaskTitle, newTaskStartDate, newTaskEndDate, newTaskDateMode, newTaskAssignees]);

    const [editingTask, setEditingTask] = useState<TaskWithThread | null>(null);
    
    // Workload View State
    const [workloadGroupBy, setWorkloadGroupBy] = useState<'user' | 'thread'>('user');
    const [expandedWorkload, setExpandedWorkload] = useState<string[]>([]);
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

    const today = startOfDay(new Date());

    // --- Logic ---

    // 1. Filter Tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (task.status === 'archived') return false;
            if (searchQuery) {
                const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
                const taskText = `${task.title} ${task.description || ""} ${task.threadTitle || ""}`.toLowerCase();
                if (!terms.every(term => taskText.includes(term))) return false;
            }

            if (statusFilter !== "all" && task.status !== statusFilter) return false;
            if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
            
            if (selectedAssignees.length > 0) {
                if (!task.assigneeIds || task.assigneeIds.length === 0) return false;
                if (!task.assigneeIds.some(id => selectedAssignees.includes(id))) return false;
            }

            if (dateRangeStart || dateRangeEnd) {
                const taskDate = task.dueDate || task.startDate || task.createdAt;
                if (!taskDate) return false;
                
                if (dateRangeStart) {
                    const start = new Date(dateRangeStart).getTime();
                    if (taskDate < start) return false;
                }
                if (dateRangeEnd) {
                    const end = new Date(dateRangeEnd).getTime() + 86400000;
                    if (taskDate >= end) return false;
                }
            }
            
            return true;
        });
    }, [tasks, searchQuery, statusFilter, priorityFilter, selectedAssignees, dateRangeStart, dateRangeEnd]);

    // 2. Sort Tasks
    const sortedTasks = useMemo(() => {
        return [...filteredTasks].sort((a, b) => {
            let res = 0;
            switch (sortBy) {
                case 'dueDate':
                    res = (a.dueDate || Infinity) - (b.dueDate || Infinity);
                    break;
                case 'priority':
                    const pMap = { high: 3, medium: 2, low: 1 };
                    res = pMap[b.priority] - pMap[a.priority];
                    break;
                case 'createdAt':
                    res = (a.createdAt || 0) - (b.createdAt || 0);
                    break;
                case 'title':
                    res = a.title.localeCompare(b.title);
                    break;
            }
            return sortAsc ? res : -res;
        });
    }, [filteredTasks, sortBy, sortAsc]);

    // 3. Group Tasks
    const groupedTasks = useMemo(() => {
        if (groupBy === 'none') return { 'すべてのタスク': sortedTasks };

        const groups: Record<string, TaskWithThread[]> = {};
        
        sortedTasks.forEach(task => {
            let key = '';
            switch (groupBy) {
                case 'thread':
                    key = task.threadTitle || 'スレッド不明';
                    break;
                case 'assignee':
                    if (!task.assigneeIds || task.assigneeIds.length === 0) {
                        key = '未割り当て';
                    } else {
                        const assigneeNames = task.assigneeIds.map(id => {
                            const u = users.find(user => user.id === id);
                            return u ? (u.nickname || u.name) : '不明';
                        }).join(', ');
                        key = assigneeNames;
                    }
                    break;
                case 'priority':
                    key = task.priority.toUpperCase();
                    break;
                case 'status':
                    key = task.status === 'in-progress' ? '進行中' : task.status === 'todo' ? '未着手' : '完了';
                    break;
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(task);
        });
        
        return groups;
    }, [sortedTasks, groupBy, users]);




    // 4. Workload Calculation
    const workloadData = useMemo(() => {
        const data: Record<string, { 
            id: string, name: string, total: number, todo: number, flowing: number, done: number, tasks: TaskWithThread[] 
        }> = {};

        filteredTasks.forEach(task => {
            if (workloadGroupBy === 'user') {
                if (!task.assigneeIds || task.assigneeIds.length === 0) {
                } else {
                    task.assigneeIds.forEach(uid => {
                        const u = users.find(user => user.id === uid);
                        const name = u ? (u.nickname || u.name) : 'Unknown';
                        if (!data[uid]) data[uid] = { id: uid, name, total: 0, todo: 0, flowing: 0, done: 0, tasks: [] };
                        
                        data[uid].total++;
                        if (task.status === 'todo') data[uid].todo++;
                        else if (task.status === 'in-progress') data[uid].flowing++;
                        else if (task.status === 'done') data[uid].done++;
                        data[uid].tasks.push(task);
                    });
                }
            } else {
                const tid = task.threadId;
                const tname = task.threadTitle;
                if (!data[tid]) data[tid] = { id: tid, name: tname, total: 0, todo: 0, flowing: 0, done: 0, tasks: [] };
                data[tid].total++;
                if (task.status === 'todo') data[tid].todo++;
                else if (task.status === 'in-progress') data[tid].flowing++;
                else if (task.status === 'done') data[tid].done++;
                data[tid].tasks.push(task);
            }
        });

        return Object.values(data).sort((a, b) => b.total - a.total);
    }, [filteredTasks, workloadGroupBy, users]);


    // --- Actions ---

    const isOverdue = (task: TaskWithThread) => {
        if (task.status === 'done') return false;
        const dueDate = task.dueDate || task.endDate;
        if (!dueDate) return false;
        return isAfter(today, new Date(dueDate));
    };

    const handleQuickStatusChange = async (task: TaskWithThread) => {
        const nextStatus: Record<Task['status'], Task['status']> = {
            'todo': 'in-progress',
            'in-progress': 'done',
            'done': 'todo',
            'archived': 'todo'
        };
        const newStatus = nextStatus[task.status];
        
        setTasks(prev => prev.map(t => 
            t.id === task.id ? { ...t, status: newStatus } : t
        ));
        
        await updateTaskStatus(task.id, task.threadId, newStatus);
    };

    const handleAddTask = async () => {
        if (!isTaskFormValid) {
            setShowValidationErrors(true);
            return;
        }
        setShowValidationErrors(false);
        
        const validAttachments = newTaskAttachments.map(a => ({
            name: a.name,
            driveFileId: a.driveFileId || a.id,
            mimeType: a.mimeType || a.type,
            webViewLink: a.webViewLink || a.url,
            size: a.size
        }));

        const data: any = {
            priority: newTaskPriority,
            assigneeIds: newTaskAssignees,
            attachments: validAttachments
        };

        if (newTaskDateMode === 'point') {
             // Deadline: Due Date only (or sync others to be safe, but conceptually distinct)
             data.dueDate = new Date(newTaskStartDate).getTime();
             data.startDate = data.dueDate; // Sync for now to show on cal
             data.endDate = data.dueDate;
        } else if (newTaskDateMode === 'scheduled') {
             // Scheduled: Start/End same day
             data.startDate = new Date(newTaskStartDate).getTime();
             data.endDate = data.startDate;
             data.dueDate = data.startDate; // Optional? Keep consistent
        } else {
             // Range
             data.startDate = new Date(newTaskStartDate).getTime();
             data.endDate = new Date(newTaskEndDate).getTime();
        }

        const result = await createTask(newTaskThread, newTaskTitle, 'todo', data);
        if (result.success && result.task) {
            const thread = threads.find(t => t.id === newTaskThread);
            setTasks(prev => [{
                ...result.task!,
                threadTitle: thread?.title || ""
            }, ...prev]);
        }
        
        // Reset
        setNewTaskTitle("");
        setNewTaskStartDate("");
        setNewTaskEndDate("");
        setNewTaskAssignees([]);
        setNewTaskPriority("medium");
        setNewTaskAttachments([]);
        setShowAddTask(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        // Ensure thread is selected
        if (!newTaskThread) {
            alert("先にスレッドを選択してください。");
            return;
        }

        Array.from(files).forEach(file => {
            uploadFile(
                file,
                { threadId: newTaskThread },
                (attachment) => {
                    setNewTaskAttachments(prev => [...prev, attachment]);
                }
            );
        });
        
        e.target.value = ""; // Reset input
    };

    const removeAttachment = (id: string) => {
         setNewTaskAttachments(prev => prev.filter(a => a.driveFileId !== id && a.id !== id));
    };

    const handleCheckAvailability = async () => {
        setIsCheckingAvailability(true);
        const date = new Date(availabilityDate).getTime();
        const members = await getAvailableMembers(date);
        setAvailableMembers(members);
        setIsCheckingAvailability(false);
    };

    const toggleAssigneeFilter = (uid: string) => {
        setSelectedAssignees(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
        setShowAddTask(false);
    };

    // --- Components ---

    // File Input Logic is defined above as handleFileUpload

    const getPriorityColor = (p: Task['priority']) => {
        switch (p) {
            case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        }
    };

    const getStatusIcon = (s: Task['status']) => {
        switch (s) {
            case 'todo': return <Clock size={16} className="text-zinc-500" />;
            case 'in-progress': return <AlertCircle size={16} className="text-amber-500" />;
            case 'done': return <CheckCircle2 size={16} className="text-emerald-500" />;
        }
    };

    const TaskCard = ({ task }: { task: TaskWithThread }) => (
        <div className={`
            group relative bg-zinc-950/40 border rounded-2xl p-4 transition-all hover:bg-zinc-900/60 hover:shadow-xl hover:-translate-y-0.5
            ${isOverdue(task) ? 'border-red-500/40 bg-red-950/20' : 'border-white/5 hover:border-white/10'}
        `}>
            {/* Thread Name & Priority */}
            <div className="flex items-center justify-between mb-3">
                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/40 text-zinc-400 border border-white/5 max-w-[60%] truncate">
                    <Briefcase size={10} />
                    <span className="truncate">{task.threadTitle}</span>
                 </span>
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                 </span>
            </div>

            <div className="flex items-start gap-4">
                 {/* Quick Status */}
                <button
                    onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(task); }}
                    className="mt-0.5 p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    title="ステータス変更"
                >
                    {getStatusIcon(task.status)}
                </button>
                
                <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setEditingTask(task)}
                >
                     {/* Title */}
                    <h3 className={`text-sm font-bold mb-2 leading-relaxed ${task.status === 'done' ? 'text-zinc-500 line-through decoration-zinc-700' : 'text-zinc-100'}`}>
                        {task.title}
                        {isOverdue(task) && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-500/20 align-middle no-underline">
                                <AlertCircle size={10} /> 期限切れ
                            </span>
                        )}
                    </h3>
                    
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                        {/* Period/Due */}
                        {(task.dueDate || task.startDate) && (
                            <span className={`flex items-center gap-1.5 ${isOverdue(task) ? 'text-red-400' : 'text-zinc-400'}`}>
                                <Calendar size={12} />
                                {task.startDate && task.endDate && task.startDate !== task.endDate ? (
                                    <>
                                        {format(task.startDate, "M/d", { locale: ja })} - {format(task.endDate, "M/d", { locale: ja })}
                                    </>
                                ) : (
                                    format(task.dueDate || task.startDate!, "M/d (E)", { locale: ja })
                                )}
                            </span>
                        )}

                        {/* Assignees */}
                        {task.assigneeIds?.length > 0 && (
                            <div className="flex -space-x-2 pl-1">
                                {task.assigneeIds.map((uid, i) => {
                                    if (i > 3) return null;
                                    const u = users.find(u => u.id === uid);
                                    return (
                                        <div key={uid} className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[9px] text-zinc-300 shadow-sm" title={u?.name}>
                                            {u?.name?.[0].toUpperCase()}
                                        </div>
                                    );
                                })}
                                {task.assigneeIds.length > 4 && (
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[9px] text-zinc-500 shadow-sm">
                                        +{task.assigneeIds.length - 4}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
             <div className="absolute bottom-4 right-4">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                    task.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                    'bg-zinc-800 text-zinc-500 border border-white/5'
                }`}
                >
                    {task.status === 'in-progress' ? '進行中' : task.status === 'todo' ? '未着手' : '完了'}
                </span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
            {/* Header / Navbar */}
            <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20">
                <div className="max-w-[1800px] mx-auto">
                    
                    {/* Top Row: Title, View Switcher, Global Actions */}
                    <div className="px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            {/* Standardized Title Style (non-italic) */}
                            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Global Todo
                            </h1>
                            
                            {/* View Switcher - Japanese */}
                            <div className="hidden md:flex bg-zinc-900/50 p-1 rounded-xl border border-white/10">
                                {(['list', 'board', 'calendar', 'workload', 'insights'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                            ${viewMode === mode 
                                                ? 'bg-zinc-800 text-white shadow-lg' 
                                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                                        `}
                                    >
                                        {mode === 'list' && <LayoutList size={14} />}
                                        {mode === 'board' && <Kanban size={14} />}
                                        {mode === 'calendar' && <Calendar size={14} />}

                                        {mode === 'workload' && <BarChart3 size={14} />}
                                        {mode === 'insights' && <Sparkles size={14} />}
                                        <span>
                                            {mode === 'list' ? 'リスト' : mode === 'board' ? 'ボード' : mode === 'calendar' ? 'カレンダー' : mode === 'workload' ? 'アサイン状況' : '分析'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Availability Check Button (Restored) */}
                             <button
                                onClick={() => setShowAvailabilityPanel(!showAvailabilityPanel)}
                                className={`p-2 rounded-full transition-all border ${showAvailabilityPanel ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white'}`}
                                title="空き状況確認"
                            >
                                <UserCheck size={18} />
                            </button>

                            {/* Search */}
                            <div className="group relative hidden sm:block">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="タスク検索..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-64 pl-11 pr-4 py-2 bg-black/20 border border-white/10 rounded-full text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:bg-zinc-900 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <button
                                onClick={() => setIsReportModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-bold hover:bg-amber-500/20 transition-all"
                            >
                                <Sparkles size={16} />
                                <span className="hidden lg:inline">AI Report</span>
                            </button>
                            
                            <button
                                onClick={() => setShowAddTask(true)}
                                className="bg-white text-black p-2 rounded-full shadow-lg hover:bg-zinc-200 transition-all"
                            >
                                <Plus size={20} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar (Hidden on Insights) */}
                    {viewMode !== 'insights' ? (
                    <div className="px-6 py-3 border-t border-white/5 bg-zinc-900/30 flex flex-wrap items-center gap-4 lg:gap-6">
                        
                        {/* Assignee Filter */}
                        <div className="relative group">
                             <button 
                                onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${selectedAssignees.length > 0 ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-black/40 border-white/5 text-zinc-400 hover:text-white'}`}
                            >
                                <User size={14} />
                                {selectedAssignees.length === 0 ? "担当者 (未選択)" : `${selectedAssignees.length}名を選択中`}
                                <ChevronDown size={12} />
                            </button>
                            {assigneeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setAssigneeDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2 z-30 custom-scrollbar">
                                        <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">メンバー選択</div>
                                        {users.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => toggleAssigneeFilter(u.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-colors ${selectedAssignees.includes(u.id) ? 'bg-indigo-500/20 text-indigo-200' : 'hover:bg-white/5 text-zinc-300'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-400">{u.name[0]}</div>
                                                    <span className="text-xs font-medium">{u.nickname || u.name}</span>
                                                </div>
                                                {selectedAssignees.includes(u.id) && <Check size={14} className="text-indigo-400" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                         <div className="h-6 w-px bg-white/10" />

                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-zinc-500 uppercase hidden xl:inline">ステータス</span>
                             <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                                 {['all', 'todo', 'in-progress', 'done'].map(s => (
                                     <button
                                         key={s}
                                         onClick={() => setStatusFilter(s)}
                                         className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all uppercase ${statusFilter === s ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                     >
                                        {s === 'all' ? '全て' : s === 'in-progress' ? '進行中' : s === 'todo' ? '未着手' : '完了'}
                                     </button>
                                 ))}
                             </div>
                         </div>

                        {/* Priority Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase hidden xl:inline">優先度</span>
                            <select 
                                value={priorityFilter} 
                                onChange={e => setPriorityFilter(e.target.value)} 
                                className="bg-black/40 border border-white/5 rounded-lg text-xs text-zinc-300 px-2 py-1.5 focus:outline-none cursor-pointer hover:text-white"
                            >
                                <option value="all" className="bg-zinc-900">全て</option>
                                <option value="high" className="bg-zinc-900">高 (High)</option>
                                <option value="medium" className="bg-zinc-900">中 (Medium)</option>
                                <option value="low" className="bg-zinc-900">低 (Low)</option>
                            </select>
                        </div>

                         {/* View Specific Controls (Hide Group/Sort on Calendar AND Workload AND Board) */}
                         {viewMode !== 'calendar' && viewMode !== 'workload' && viewMode !== 'board' && (
                             <>
                                <div className="h-6 w-px bg-white/10" />
                                
                                <div className="flex items-center gap-2">
                                    <Layers size={14} className="text-zinc-500" />
                                    <select 
                                        value={groupBy}
                                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                                        className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                                    >
                                        <option value="none" className="bg-zinc-900">グループなし</option>
                                        <option value="thread" className="bg-zinc-900">スレッド</option>
                                        <option value="assignee" className="bg-zinc-900">担当者</option>
                                        <option value="status" className="bg-zinc-900">ステータス</option>
                                        <option value="priority" className="bg-zinc-900">優先度</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <ArrowUpDown size={14} className="text-zinc-500" />
                                    <select 
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                                        className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                                    >
                                        <option value="createdAt" className="bg-zinc-900">作成日</option>
                                        <option value="dueDate" className="bg-zinc-900">期限</option>
                                        <option value="priority" className="bg-zinc-900">優先度</option>
                                        <option value="title" className="bg-zinc-900">タイトル</option>
                                    </select>
                                </div>
                             </>
                         )}

                         {/* Date Range (Always Visible) */}
                         <div className="h-6 w-px bg-white/10" />
                         <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-zinc-500" />
                            <input 
                                type="date" 
                                value={dateRangeStart} 
                                onChange={e => setDateRangeStart(e.target.value)} 
                                className="bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                            />
                            <span className="text-zinc-600 text-xs">-</span>
                            <input 
                                type="date" 
                                value={dateRangeEnd} 
                                onChange={e => setDateRangeEnd(e.target.value)} 
                                className="bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                            />
                         </div>
                         
                         {/* Clear Filters */}
                         <button
                            onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("all");
                                setPriorityFilter("all");
                                setSelectedAssignees([]);
                                setDateRangeStart("");
                                setDateRangeEnd("");
                            }}
                            className="ml-auto text-[10px] text-zinc-500 hover:text-white underline decoration-zinc-800 hover:decoration-white transition-all"
                        >
                            リセット
                        </button>
                    </div>
                    ) : null}

                    {/* Availability Panel (Collapsible) */}
                    {showAvailabilityPanel && (
                         <div className="border-t border-white/5 bg-zinc-900/60 backdrop-blur-md animate-in slide-in-from-top-2 p-4">
                            <div className="flex items-center gap-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <UserCheck size={16} className="text-indigo-400" />
                                    空き状況確認
                                </h3>
                                <input 
                                    type="date"
                                    value={availabilityDate}
                                    onChange={e => setAvailabilityDate(e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]"
                                />
                                <button 
                                    onClick={handleCheckAvailability}
                                    className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    {isCheckingAvailability ? '確認中...' : '確認する'}
                                </button>
                            </div>
                            {availableMembers.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in">
                                    {availableMembers.map(m => (
                                        <div key={m.id} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-emerald-400 text-xs font-medium">{m.name} <span className="text-emerald-500/50">({m.taskCount}件)</span></span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!isCheckingAvailability && availableMembers.length === 0 && availabilityDate && showAvailabilityPanel && (
                                // Show message only if actually checked... simplified logic here for brevity
                                <p className="text-xs text-zinc-500 mt-2">※ 日付を選択して確認ボタンを押してください</p>
                            )}
                         </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[#050510] relative custom-scrollbar">
                <div className="max-w-[1800px] mx-auto p-6">
                    
                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                        <div className="space-y-12 pb-20">
                            {Object.entries(groupedTasks).map(([group, tasks]) => (
                                <div key={group} className="space-y-4">
                                    {groupBy !== 'none' && (
                                        <div className="flex items-center gap-4 py-2 border-b border-white/5">
                                            <h2 className="text-lg font-bold text-zinc-200">{group}</h2>
                                            <span className="text-xs font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-full">{tasks.length}</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {tasks.map(task => <TaskCard key={task.id} task={task} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* BOARD VIEW */}
                    {viewMode === 'board' && (
                        <div className="h-[calc(100vh-250px)]">
                            <BoardView 
                                tasks={sortedTasks} 
                                setTasks={setTasks} 
                                users={users} 
                                threads={threads}
                                onEdit={setEditingTask}
                                groupBy={groupBy}
                            />
                        </div>
                    )}

                    {/* CALENDAR VIEW */}
                    {viewMode === 'calendar' && (
                        <div className="h-[calc(100vh-250px)] flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <span className="bg-gradient-to-tr from-indigo-500 to-purple-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Calendar className="text-white" size={16} />
                                    </span>
                                    {format(calendarDate, "yyyy年 M月", { locale: ja })}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setShowSchoolEvents(!showSchoolEvents)}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
                                            ${showSchoolEvents 
                                                ? 'bg-slate-600/20 border-slate-500/50 text-slate-200' 
                                                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'}
                                        `}
                                    >
                                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${showSchoolEvents ? 'bg-slate-500 border-transparent' : 'border-zinc-500'}`}>
                                            {showSchoolEvents && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        </div>
                                        高校予定表
                                    </button>
                                    <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5">
                                        <button onClick={() => setCalendarDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"><ChevronDown className="rotate-90" size={16} /></button>
                                        <button onClick={() => setCalendarDate(new Date())} className="px-3 text-xs font-bold text-zinc-300 hover:text-white border-l border-r border-white/5">今日</button>
                                        <button onClick={() => setCalendarDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"><ChevronDown className="-rotate-90" size={16} /></button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 bg-zinc-900/10 rounded-2xl border border-white/5 overflow-y-auto backdrop-blur-sm min-h-0 custom-scrollbar">
                                <CalendarView 
                                    tasks={[
                                        ...filteredTasks,
                                        ...(showSchoolEvents ? schoolEvents.map((e: any) => ({
                                            ...e,
                                            isExternal: true,
                                            threadTitle: '高校予定表',
                                            assigneeIds: [],
                                            description: '',
                                            files: [],
                                            reactions: [],
                                            subtasks: []
                                        })) : [])
                                    ]}
                                    currentDate={calendarDate}
                                    onDateChange={setCalendarDate}
                                    onTaskClick={(t) => {
                                        if ((t as any).isExternal) return;
                                        setEditingTask(t);
                                    }}
                                    onAddClick={(date) => {
                                        setNewTaskStartDate(format(date, 'yyyy-MM-dd'));
                                        setNewTaskDateMode('point');
                                        setShowAddTask(true);
                                    }}
                                />
                            </div>
                        </div>
                    )}



                    {/* WORKLOAD VIEW */}
                    {viewMode === 'workload' && (
                        <div className="space-y-8 pb-20 animate-in fade-in">
                             {/* Controls */}
                             <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                                 <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/10">
                                     <button onClick={() => setWorkloadGroupBy('user')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${workloadGroupBy === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>ユーザー別</button>
                                     <button onClick={() => setWorkloadGroupBy('thread')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${workloadGroupBy === 'thread' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>スレッド別</button>
                                 </div>
                                 <div className="h-8 w-px bg-white/10" />
                                 <div className="flex-1">
                                     <h3 className="text-sm font-bold text-zinc-200">アサイン状況</h3>
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {workloadData.map(w => (
                                    <div key={w.id} className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900/60 transition-colors group">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-200 font-bold border border-white/10 shadow-lg">
                                                    {w.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-base text-zinc-100">{w.name}</h4>
                                                    <div className="text-xs text-zinc-500">{w.total} タスク</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-2xl font-black text-white">{Math.round((w.done / Math.max(w.total, 1)) * 100)}<span className="text-sm font-medium text-zinc-500 ml-1">%</span></span>
                                                <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider">完了率</span>
                                            </div>
                                        </div>

                                        <div className="h-4 bg-zinc-950 rounded-full overflow-hidden flex mb-6 border border-white/5">
                                            <div className="h-full bg-zinc-700 transition-all duration-500 relative group/bar" style={{ width: `${(w.todo / Math.max(w.total, 1)) * 100}%` }}></div>
                                            <div className="h-full bg-amber-500 transition-all duration-500 relative group/bar" style={{ width: `${(w.flowing / Math.max(w.total, 1)) * 100}%` }}></div>
                                            <div className="h-full bg-emerald-500 transition-all duration-500 relative group/bar" style={{ width: `${(w.done / Math.max(w.total, 1)) * 100}%` }}></div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            <div className="text-center p-2 bg-zinc-950/50 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-zinc-500 font-bold mb-1">未着手</div>
                                                <div className="text-lg font-bold text-zinc-300">{w.todo}</div>
                                            </div>
                                            <div className="text-center p-2 bg-amber-950/10 rounded-xl border border-amber-500/10">
                                                <div className="text-[10px] text-amber-500/70 font-bold mb-1">進行中</div>
                                                <div className="text-lg font-bold text-amber-500">{w.flowing}</div>
                                            </div>
                                            <div className="text-center p-2 bg-emerald-950/10 rounded-xl border border-emerald-500/10">
                                                 <div className="text-[10px] text-emerald-500/70 font-bold mb-1">完了</div>
                                                <div className="text-lg font-bold text-emerald-500">{w.done}</div>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => setExpandedWorkload(prev => prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id])}
                                            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                        >
                                            {expandedWorkload.includes(w.id) ? '閉じる' : 'タスク内訳'}
                                            <ChevronDown size={14} className={`transition-transform duration-300 ${expandedWorkload.includes(w.id) ? 'rotate-180' : ''}`} />
                                        </button>

                                        {expandedWorkload.includes(w.id) && (
                                            <div className="mt-4 pt-4 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2">
                                                {w.tasks.slice(0, 5).map(t => (
                                                    <div key={t.id} className="flex items-center justify-between text-xs p-2 hover:bg-white/5 rounded-lg cursor-pointer" onClick={() => setEditingTask(t)}>
                                                        <span className="truncate max-w-[70%] text-zinc-300">{t.title}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${t.status==='done'?'bg-emerald-500':t.status==='in-progress'?'bg-amber-500':'bg-zinc-500'}`} />
                                                        </div>
                                                    </div>
                                                ))}
                                                {w.tasks.length > 5 && (
                                                    <div className="text-center text-[10px] text-zinc-600 mt-2">
                                                        +{w.tasks.length - 5} more
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                    
                    {/* INSIGHTS VIEW */}
                    {viewMode === 'insights' && (
                        <InsightsView tasks={tasks} onTaskClick={setEditingTask} />
                    )}
                </div>
            </main>

            {/* Modals */}
             {showAddTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />
                        
                        <div className="flex items-center justify-between relative">
                            <h2 className="text-xl font-black text-white">新規タスク作成</h2>
                            <button onClick={() => setShowAddTask(false)} className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-6 relative">
                            {/* Basics */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center justify-between">
                                        タイトル
                                    </label>
                                    <input 
                                        type="text" 
                                        value={newTaskTitle}
                                        onChange={e => setNewTaskTitle(e.target.value)}
                                        placeholder="タスク名を入力..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                        autoFocus
                                    />
                                    {showValidationErrors && !newTaskTitle.trim() && (
                                        <p className="text-red-500 text-[10px] ml-1 mt-1 font-bold animate-in fade-in">タイトルを入力してください</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">スレッド</label>
                                    <select 
                                        value={newTaskThread}
                                        onChange={e => setNewTaskThread(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="" disabled>スレッドを選択</option>
                                        {threads.map(t => (
                                            <option key={t.id} value={t.id} className="bg-zinc-900">{t.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Priority & Date */}
                                <div className="space-y-4">
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">優先度</label>
                                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                            {(['low', 'medium', 'high'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setNewTaskPriority(p)}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase transition-all ${
                                                        newTaskPriority === p 
                                                        ? p === 'high' ? 'bg-red-500/20 text-red-400 shadow-sm border border-red-500/20' 
                                                        : p === 'medium' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/20' 
                                                        : 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/20'
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-zinc-500 uppercase">日付</label>
                                            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-white/5">
                                                <button onClick={() => setNewTaskDateMode('point')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${newTaskDateMode==='point'?'bg-zinc-700 text-white':'text-zinc-500'}`}>期限</button>
                                                <button onClick={() => setNewTaskDateMode('scheduled')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${newTaskDateMode==='scheduled'?'bg-zinc-700 text-white':'text-zinc-500'}`}>予定日</button>
                                                <button onClick={() => setNewTaskDateMode('range')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${newTaskDateMode==='range'?'bg-zinc-700 text-white':'text-zinc-500'}`}>期間</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <input 
                                                type="date"
                                                value={newTaskStartDate}
                                                onChange={e => setNewTaskStartDate(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none [color-scheme:dark]"
                                                placeholder={newTaskDateMode === 'point' ? "期限日" : newTaskDateMode === 'scheduled' ? "予定日" : "開始日"}
                                            />
                                            {newTaskDateMode === 'range' && (
                                                <input 
                                                    type="date"
                                                    value={newTaskEndDate}
                                                    onChange={e => setNewTaskEndDate(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none [color-scheme:dark]"
                                                    placeholder="終了日"
                                                />
                                            )}
                                        </div>
                                        {showValidationErrors && ((newTaskDateMode === 'point' && !newTaskStartDate) || (newTaskDateMode === 'scheduled' && !newTaskStartDate) || (newTaskDateMode === 'range' && (!newTaskStartDate || !newTaskEndDate))) && (
                                            <p className="text-red-500 text-[10px] ml-1 mt-1 font-bold animate-in fade-in">日付を選択してください</p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Assignees */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">担当者</label>
                                        <button 
                                            onClick={() => {
                                                if (newTaskAssignees.length === users.length) setNewTaskAssignees([]);
                                                else setNewTaskAssignees(users.map(u => u.id));
                                            }}
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                                        >
                                            {newTaskAssignees.length === users.length ? '解除' : '全員選択'}
                                        </button>
                                    </div>
                                    <div className={`bg-black/40 border border-white/10 rounded-xl overflow-hidden h-40 flex flex-col transition-colors ${showValidationErrors && newTaskAssignees.length === 0 ? 'border-red-500/30 bg-red-500/5' : ''}`}>
                                        <input 
                                            placeholder="検索..." 
                                            className="bg-white/5 border-b border-white/5 px-3 py-2 text-xs text-white outline-none"
                                            value={newTaskAssigneeSearch}
                                            onChange={e => setNewTaskAssigneeSearch(e.target.value)}
                                        />
                                        <div className="flex-1 overflow-y-auto p-1 space-y-1 custom-scrollbar">
                                            {users.filter(u => (u.nickname || u.name || "").toLowerCase().includes(newTaskAssigneeSearch.toLowerCase())).map(u => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => setNewTaskAssignees(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${newTaskAssignees.includes(u.id) ? 'bg-indigo-500/20 text-indigo-200' : 'hover:bg-white/5 text-zinc-400'}`}
                                                >
                                                    <span className="text-xs font-bold">{u.nickname || u.name}</span>
                                                    {newTaskAssignees.includes(u.id) && <Check size={12} className="text-indigo-400" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {showValidationErrors && newTaskAssignees.length === 0 && (
                                        <p className="text-red-500 text-[10px] ml-1 mt-1 font-bold animate-in fade-in">担当者を選択してください</p>
                                    )}
                                </div>
                            </div>

                            {/* Attachments */}
                            <div className="space-y-2 pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                        <Paperclip size={12} /> 添付ファイル
                                    </label>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/10 px-2 py-1 rounded hover:bg-indigo-500/20 transition-colors"
                                    >
                                        ファイルを追加
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    multiple
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload}
                                />
                                {newTaskAttachments.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {newTaskAttachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-white/5 group hover:border-white/10 transition-all">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                                        <FileIcon size={14} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs text-zinc-200 font-medium truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                        <span className="text-[10px] text-zinc-500">{Math.round(file.size / 1024)} KB</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => removeAttachment(file.driveFileId || file.id)} 
                                                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                                >
                                                    <X size={14}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleAddTask}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus size={20} strokeWidth={3} />
                                タスクを作成
                            </button>
                        </div>
                    </div>
                </div>
             )}

            {editingTask && (
                <EditTaskModal
                    task={editingTask as Task} 
                    isOpen={!!editingTask}
                    onClose={() => setEditingTask(null)}
                    users={users.map(u => ({ uid: u.id, ...u }))}
                />
            )}
            <ReportModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
            />
        </div>
    );
}
