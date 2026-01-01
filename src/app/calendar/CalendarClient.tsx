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
                <div className="grid grid-cols-7 gap-px bg-zinc-800/50 border border-white/5 rounded-t-2xl overflow-hidden">
                    {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                        <div key={day} className={`p-3 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-zinc-400'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Body */}
                <div className="bg-zinc-900/30 flex-1 grid grid-cols-7 grid-rows-6 gap-px border-x border-b border-white/5 rounded-b-2xl overflow-hidden">
                    {/* No padding days needed, calendarDays covers it */}
                    
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
                                {/* Date Number Header */}
                                <div className="p-2 flex justify-between items-start">
                                    <span className={`
                                        h-6 w-6 flex items-center justify-center rounded-full text-sm font-medium
                                        ${isTodayDate ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 
                                          isCurrentMonth ? 'text-zinc-400' : 'text-zinc-700'}
                                    `}>
                                        {format(date, 'd')}
                                    </span>
                                </div>

                                {/* Slots */}
                                <div 
                                    className="flex-1 flex flex-col overflow-x-hidden overflow-y-hidden hover:overflow-y-auto pb-1 relative no-scrollbar"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {slots.map((slot, i) => {
                                        if (slot.type === 'empty') {
                                            return <div key={`empty-${i}`} className="h-5 mb-[1px]" />;
                                        }
                                        
                                        // slot.type === 'event'
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
                                                {/* Always show Icon if logic demands, or only when text is shown? 
                                                    User emphasized "Unity with Thread". Thread shows Icon + Title. 
                                                    Google Calendar shows (Bullet + Title).
                                                    Let's show Icon + Title when showText is true.
                                                    When showText is false (middle of week continuation), just the bar?
                                                    But if a task spans multiple weeks, the start of 2nd week needs a label? 
                                                    Yes, showText handles (isStart || isSunday).
                                                */}
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
