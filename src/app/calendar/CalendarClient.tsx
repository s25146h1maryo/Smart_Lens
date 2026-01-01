"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, getDay, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CalendarDays, Pin, CheckSquare, Link as LinkIcon, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import TaskDetailModal from "./TaskDetailModal";
import { calculateCalendarLayout } from "./layoutUtils";
import { Task } from "@/types";

type CalendarTask = Task & { threadTitle: string; isExternal?: boolean };

export default function CalendarClient({ internalTasks, externalTasks, userId, users }: { internalTasks: CalendarTask[], externalTasks: CalendarTask[], userId: string, users: any[] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filter, setFilter] = useState<'all' | 'assigned'>('assigned');
    const [showExternal, setShowExternal] = useState(true); // Default ON
    const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

    const handleCopyExportUrl = () => {
        const url = `${window.location.origin}/api/calendar/${userId}`;
        navigator.clipboard.writeText(url);
        // Simple alert for now, or a toast if available.
        alert("カレンダーフィードのURLをコピーしました！\nGoogleカレンダーなどにこのURLを追加してください。");
    };

    // Derived Data: Full Calendar Grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); 
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const filteredTasks = useMemo(() => {
        // 1. Filter Internal
        const internal = internalTasks.filter(t => {
            if (filter === 'assigned' && !t.assigneeIds.includes(userId)) return false;
            return true;
        });
        
        // 2. Filter External
        const external = showExternal ? externalTasks : [];

        // 3. Combine
        return [...internal, ...external];
    }, [internalTasks, externalTasks, filter, userId, showExternal]);

    // Layout Calculation matches the visible grid
    const layout = useMemo(() => {
        return calculateCalendarLayout(calendarDays, filteredTasks);
    }, [calendarDays, filteredTasks]);

    // Helper for Icons (Unity with Thread View)
    const getTaskIcon = (task: Task) => {
        if (task.dueDate) return <AlertCircle size={12} className="shrink-0" />;
        if (task.startDate && task.endDate && task.startDate !== task.endDate) return <CalendarDays size={12} className="shrink-0" />;
        // Saved "Planned" tasks
        return <Pin size={12} className="shrink-0" />;
    };

    const getTaskStyle = (task: CalendarTask, isStart: boolean, isEnd: boolean, date: Date) => {
        const isSunday = getDay(date) === 0;
        
        // Base
        let base = "h-5 text-[10px] flex items-center px-1 truncate mb-[1px] cursor-pointer transition-opacity relative z-10 font-medium";
        
        // Colors
        let colorClass = "";
        if (task.isExternal) {
            colorClass = "bg-slate-600 text-white hover:bg-slate-500 opacity-90";
        } else {
            switch (task.priority) {
                case 'high': colorClass = "bg-rose-600 text-white hover:bg-rose-500"; break;
                case 'medium': colorClass = "bg-amber-600 text-white hover:bg-amber-500"; break;
                case 'low': colorClass = "bg-emerald-600 text-white hover:bg-emerald-500"; break;
                default: colorClass = "bg-indigo-600 text-white hover:bg-indigo-500";
            }
        }

        // Shape & Position
        let shapeClass = "";
        // If it's the very first segment visually rendered (isStart) OR logically the start of week
        // Note: isStart is determined by layoutUtils as "Is this the Start Date of the task?".
        // But if a task spans multiple weeks, the segment at the start of the week needs to look "broken" from left?
        // Google Calendar:
        // Week 1: [Start--->]
        // Week 2: [<---End]
        // Rounded corners only on logical start/end.
        // Borders: usually none between days.
        
        if (isStart) {
            shapeClass += " rounded-l ml-1";
        } else {
            shapeClass += " ml-[-1px] border-l border-white/20"; 
             // If Sunday, it's a visual break, so maybe we want to round it? 
             // Usually generic calendars don't round the "continued" part, just keeping it flat indicates continuation.
             // But we need to ensure it doesn't look like a new task.
        }

        if (isEnd) {
            shapeClass += " rounded-r mr-1";
        } else {
            shapeClass += " mr-[-1px] border-r border-white/20";
        }

        // Text Visibility: Show if Start Date OR First Day of Week
        const showText = isStart || isSunday;

        return { className: `${base} ${colorClass} ${shapeClass}`, showText };
    };
    
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    return (
        <div className="flex flex-col h-full bg-[#050510]">
            {/* Header */}
            <UnifiedHeader 
                title="タスクカレンダー"
                className="px-6 py-2 border-b border-white/5 bg-black/20 backdrop-blur-md !mb-0"
                leftChildren={
                    <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                        >
                            全体
                        </button>
                        <button 
                            onClick={() => setFilter('assigned')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'assigned' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                        >
                            自分のタスク
                        </button>
                    </div>
                }
            >
                <button onClick={goToToday} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">今日</button>
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg p-1 border border-white/5">
                    <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded text-zinc-400"><ChevronLeft size={20} /></button>
                    <span className="px-3 font-bold min-w-[140px] text-center">
                        {format(currentDate, 'yyyy年 MMMM', { locale: ja })}
                    </span>
                    <button onClick={nextMonth} className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded text-zinc-400"><ChevronRight size={20} /></button>
                </div>
            </UnifiedHeader>

            {/* Calendar Grid */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {/* Days Header */}
                {/* Days Header - Desktop Only */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-7 gap-px bg-zinc-800/50 border border-white/5 rounded-t-2xl overflow-hidden">
                            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                                <div key={day} className={`p-3 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-zinc-400'}`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Body */}
                        <div className="bg-zinc-900/30 grid grid-cols-7 grid-rows-6 gap-px border-x border-b border-white/5 rounded-b-2xl overflow-hidden">
                            {/* Desktop Grid Implementation */} 
                            {calendarDays.map(date => {
                                const dateKey = date.toISOString();
                                const slots = layout[dateKey] || [];
                                const isTodayDate = isToday(date);
                                const isCurrentMonth = isSameMonth(date, currentDate);
                                
                                return (
                                    <div 
                                        key={dateKey} 
                                        className={`
                                            relative transition-colors min-h-[100px] flex flex-col group
                                            ${isCurrentMonth ? 'bg-transparent' : 'bg-black/40 text-zinc-700'}
                                            hover:bg-white/[0.02]
                                        `}
                                    >
                                        <div className="p-2 flex justify-between items-start">
                                            <span className={`
                                                h-6 w-6 flex items-center justify-center rounded-full text-sm font-medium
                                                ${isTodayDate ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 
                                                  isCurrentMonth ? 'text-zinc-400' : 'text-zinc-700'}
                                            `}>
                                                {format(date, 'd')}
                                            </span>
                                        </div>

                                        <div 
                                            className="flex-1 flex flex-col overflow-x-hidden overflow-y-hidden hover:overflow-y-auto pb-1 relative no-scrollbar"
                                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                        >
                                            {slots.map((slot, i) => {
                                                if (slot.type === 'empty') {
                                                    return <div key={`empty-${i}`} className="h-5 mb-[1px]" />;
                                                }
                                                
                                                const { task, isStart, isEnd } = slot;
                                                const { className, showText } = getTaskStyle(task as any, isStart, isEnd, date);
                                                const icon = getTaskIcon(task);

                                                return (
                                                    <div 
                                                        key={`${task.id}-${i}`}
                                                        className={className}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTask(task as CalendarTask);
                                                        }}
                                                        title={task.title}
                                                    >
                                                        {showText && (
                                                            <div className="flex items-center gap-0.5 overflow-hidden w-full">
                                                                {(!task.isAllDay && task.startDate && isSameDay(date, new Date(task.startDate))) && (
                                                                    <span className="font-mono text-[8px] opacity-90 mr-0.5 shrink-0 bg-black/20 px-0.5 rounded">
                                                                        {format(new Date(task.startDate), 'HH:mm')}
                                                                    </span>
                                                                )}
                                                                {icon}
                                                                <span className="truncate sticky left-0 px-1">{task.title}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mobile Day List View (Vertical) */}
                <div className="md:hidden space-y-2 overflow-y-auto pb-20">
                    {calendarDays.filter(d => isSameMonth(d, currentDate)).map(date => {
                         const dateKey = date.toISOString();
                         // layout has slots. slots have type 'event' or 'empty'. WE ONLY WANT EVENTS.
                         // Also, we want unique events for list view? No, list view usually shows time.
                         // layout logic puts tasks in slots to avoid overlap.
                         // But for mobile list, we just want a list of tasks for this day.
                         // Extract tasks from slots.
                         const slots = layout[dateKey] || [];
                         const tasksForDay = slots.filter(s => s.type === 'event').map(s => s.task as CalendarTask);
                         
                         // Deduplicate tasks if layout engine put same task in multiple slots (unlikely for 1 day, but possible if buggy)
                         // Actually layout engine is for visual grid. 
                         // For List View, maybe simpler to filter `filteredTasks` manually?
                         // `filteredTasks` contains all tasks.
                         // Check if task falls on this day.
                         // A task falls on this day if (startDate <= date && endDate >= date).
                         // Using layout is convenient because it already calculated date ranges.
                         // Let's use tasksForDay from slots.
                         
                         if (tasksForDay.length === 0) return null; // Hide empty days to save space on mobile? Or show them?
                         // User said "Vertical list". Showing detailed empty days might be too much scrolling.
                         // Let's show All Days but compact if empty?
                         // Or "Agenda" style usually skips empty days or groups them.
                         // Let's show date header + tasks. If empty, maybe just header or skip.
                         // Let's skip empty days for "Zero Horizontal Scroll" efficiency (less vertical too).
                         
                         const isTodayDate = isToday(date);
                         
                         return (
                             <div key={dateKey} className="bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden">
                                 {/* Day Header */}
                                 <div className={`
                                     px-4 py-2 flex items-center justify-between
                                     ${isTodayDate ? 'bg-indigo-600/20' : 'bg-white/[0.02]'}
                                 `}>
                                     <div className="flex items-center gap-3">
                                         <span className={`text-lg font-bold ${isTodayDate ? 'text-indigo-400' : 'text-zinc-300'}`}>
                                             {format(date, 'd')}
                                         </span>
                                         <span className="text-xs text-zinc-500 uppercase font-bold">
                                             {format(date, 'EEEE', { locale: ja })}
                                         </span>
                                         {isTodayDate && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">Today</span>}
                                     </div>
                                 </div>
                                 
                                 {/* Task List */}
                                 <div className="p-2 space-y-2">
                                     {tasksForDay.map(task => (
                                         <div 
                                            key={task.id}
                                            onClick={() => setSelectedTask(task)}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 active:scale-[0.98] transition-all"
                                         >
                                             {/* Time / Icon */}
                                             <div className="flex flex-col items-center min-w-[40px] gap-1">
                                                 {!task.isAllDay && task.startDate ? (
                                                     <span className="text-[10px] font-mono text-zinc-400">
                                                         {format(new Date(task.startDate), 'HH:mm')}
                                                     </span>
                                                 ) : (
                                                     <span className="text-[10px] font-bold text-zinc-500">All Day</span>
                                                 )}
                                                 <div className={`w-1 h-8 rounded-full ${
                                                     task.priority === 'high' ? 'bg-red-500' :
                                                     task.priority === 'medium' ? 'bg-amber-500' :
                                                     task.priority === 'low' ? 'bg-emerald-500' : 'bg-indigo-500'
                                                 }`} />
                                             </div>
                                             
                                             {/* Content */}
                                             <div className="flex-1 min-w-0">
                                                 <div className="text-sm font-bold text-zinc-200 truncate">{task.title}</div>
                                                 {task.threadTitle && <div className="text-[10px] text-zinc-500 truncate">{task.threadTitle}</div>}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         );
                    })}
                </div>
            </div>

            {/* Modal */}
            {selectedTask && (
                <TaskDetailModal 
                    task={selectedTask} 
                    users={users} 
                    onClose={() => setSelectedTask(null)} 
                />
            )}
        </div>
    );
}
