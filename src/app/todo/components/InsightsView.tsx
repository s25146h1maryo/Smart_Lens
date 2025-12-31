"use client";

import { TaskWithThread } from "@/app/actions/global_todo";
import { format, isAfter, startOfDay, addDays, differenceInDays, subDays, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, Clock, Briefcase, Calendar as CalendarIcon, Activity, Layers, Check, Link as LinkIcon, ExternalLink, X, Archive } from "lucide-react";
import { useMemo, useState } from "react";
import ArchivedTasksModal from "@/app/thread/[id]/ArchivedTasksList";

interface InsightsViewProps {
    tasks: TaskWithThread[];
    onTaskClick: (task: TaskWithThread) => void;
}

export default function InsightsView({ tasks, onTaskClick }: InsightsViewProps) {
    const today = startOfDay(new Date());    const [showArchivedModal, setShowArchivedModal] = useState(false);


    const metrics = useMemo(() => {
        const analyzableTasks = tasks.filter(t => t.status !== 'archived');
        const archivedCount = tasks.filter(t => t.status === 'archived').length;

        const total = analyzableTasks.length;
        const done = analyzableTasks.filter(t => t.status === 'done').length;
        const inProgress = analyzableTasks.filter(t => t.status === 'in-progress').length;
        const todo = analyzableTasks.filter(t => t.status === 'todo').length;
        
        const overdue = analyzableTasks.filter(t => {
            if (t.status === 'done') return false;
            const d = t.dueDate || t.endDate;
            return d && isAfter(today, new Date(d));
        }).length;

        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

        // Activity Log (Created vs Done - Last 14 days)
        const activityData = Array.from({ length: 14 }).map((_, i) => {
            const date = subDays(today, 13 - i);
            const createdCount = analyzableTasks.filter(t => t.createdAt && isSameDay(new Date(t.createdAt), date)).length;
            const doneCount = analyzableTasks.filter(t => t.status === 'done' && t.updatedAt && isSameDay(new Date(t.updatedAt), date)).length;
            return { date, created: createdCount, completed: doneCount };
        });
        const maxActivity = Math.max(...activityData.map(d => Math.max(d.created, d.completed)), 1);

        // Thread Health
        const threadMap = new Map<string, { title: string, total: number, done: number, inProgress: number }>();
        analyzableTasks.forEach(t => {
            if (!threadMap.has(t.threadId)) {
                threadMap.set(t.threadId, { title: t.threadTitle || "Unknown", total: 0, done: 0, inProgress: 0 });
            }
            const tm = threadMap.get(t.threadId)!;
            tm.total++;
            if (t.status === 'done') tm.done++;
            if (t.status === 'in-progress') tm.inProgress++;
        });
        const threadHealth = Array.from(threadMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // Task Ageing
        const activeTasks = analyzableTasks.filter(t => t.status !== 'done');
        const ageingBuckets = {
            week: activeTasks.filter(t => differenceInDays(today, t.createdAt) <= 7).length,
            month: activeTasks.filter(t => {
                const age = differenceInDays(today, t.createdAt);
                return age > 7 && age <= 30;
            }).length,
            old: activeTasks.filter(t => differenceInDays(today, t.createdAt) > 30).length,
        };

        // Upcoming Deadlines
        const nextWeek = addDays(today, 7);
        const upcoming = analyzableTasks
            .filter(t => {
                if (t.status === 'done') return false;
                const d = t.dueDate || t.endDate;
                if (!d) return false;
                const date = new Date(d);
                return isAfter(date, today) && isAfter(nextWeek, date) === false;
            })
            .sort((a, b) => (a.dueDate || a.endDate || 0) - (b.dueDate || b.endDate || 0))
            .slice(0, 5);

        // -- New Metrics --
        // Avg Completion Speed (Days from Created -> Updated(Done))
        const doneTasks = analyzableTasks.filter(t => t.status === 'done' && t.updatedAt);
        const totalDays = doneTasks.reduce((acc, t) => {
            const days = differenceInDays(new Date(t.updatedAt!), new Date(t.createdAt));
            return acc + Math.max(0, days);
        }, 0);
        const avgDays = doneTasks.length > 0 ? (totalDays / doneTasks.length).toFixed(1) : "0.0";

        // Velocity (Tasks done in last 7 days)
        const velocity = analyzableTasks.filter(t => {
            if (t.status !== 'done' || !t.updatedAt) return false;
            return isAfter(new Date(t.updatedAt), subDays(today, 7));
        }).length;

        return { 
            total, done, inProgress, todo, overdue, completionRate, 
            activityData, maxActivity, threadHealth, ageingBuckets, upcoming, archivedCount,
            avgDays, velocity
        };
    }, [tasks]);

    const archivedTasks = useMemo(() => tasks.filter(t => t.status === 'archived'), [tasks]);

    const [activeDrillDown, setActiveDrillDown] = useState<'total' | 'done' | 'in-progress' | 'todo' | 'overdue' | null>(null);

    // Filter tasks for drill-down
    const drillDownTasks = useMemo(() => {
        if (!activeDrillDown) return [];
        switch (activeDrillDown) {
            case 'total': return tasks.filter(t => t.status !== 'archived');
            case 'done': return tasks.filter(t => t.status === 'done');
            case 'in-progress': return tasks.filter(t => t.status === 'in-progress');
            case 'todo': return tasks.filter(t => t.status === 'todo');
            case 'overdue': return tasks.filter(t => {
                if (t.status === 'done' || t.status === 'archived') return false;
                const d = t.dueDate || t.endDate;
                return d && isAfter(today, new Date(d));
            });
            default: return [];
        }
    }, [tasks, activeDrillDown, today]);

    // Status Donut
    const totalStatus = metrics.total;
    const doneDeg = (metrics.done / Math.max(totalStatus, 1)) * 360;
    const flowingDeg = (metrics.inProgress / Math.max(totalStatus, 1)) * 360;
    const todoDeg = (metrics.todo / Math.max(totalStatus, 1)) * 360;

    const donutStyle = {
        background: `conic-gradient(
            #10b981 0deg ${doneDeg}deg,
            #f59e0b ${doneDeg}deg ${doneDeg + flowingDeg}deg,
            #3f3f46 ${doneDeg + flowingDeg}deg 360deg
        )`
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4">
            
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    icon={<CheckCircle2 className="text-emerald-500" size={24} />}
                    label="プロジェクト完了率"
                    value={`${metrics.completionRate}%`}
                    sub={`${metrics.done} / ${metrics.total} Tasks`}
                    color="emerald"
                    onClick={() => setActiveDrillDown('total')}
                />

                <KPICard 
                    icon={<CheckCircle2 className="text-emerald-500" size={24} />}
                    label="完了タスク"
                    labelOverride="完了 (Done)"
                    value={metrics.done}
                    sub={`${metrics.completionRate}% Rate`}
                    color="emerald"
                    onClick={() => setActiveDrillDown('done')}
                />
                
                <KPICard 
                    icon={<Activity className="text-amber-500" size={24} />}
                    label="進行中 (In Progress)"
                    value={metrics.inProgress}
                    sub="Active Work"
                    color="amber"
                    onClick={() => setActiveDrillDown('in-progress')}
                />
                
                <KPICard 
                    icon={<Clock className="text-zinc-500" size={24} />}
                    label="未着手 (Todo)"
                    value={metrics.todo}
                    sub="Backlog"
                    color="zinc"
                    onClick={() => setActiveDrillDown('todo')}
                />

                <KPICard 
                    icon={<AlertCircle className="text-red-500" size={24} />}
                    label="期限切れ (Overdue)"
                    value={metrics.overdue}
                    sub="Act Now"
                    color="red"
                    onClick={() => setActiveDrillDown('overdue')}
                />

                 <KPICard 
                    icon={<Clock className="text-blue-500" size={24} />}
                    label="平均完了時間"
                    value={`${metrics.avgDays}日`}
                    sub="Avg. Days"
                    color="blue"
                />
                 <KPICard 
                    icon={<TrendingUp className="text-pink-500" size={24} />}
                    label="消化速度"
                    value={`${metrics.velocity}/週`}
                    sub="Tasks/Week"
                    color="pink"
                />
                
                <KPICard 
                    icon={<Archive className="text-purple-500" size={24} />}
                    label="完全完了"
                    value={metrics.archivedCount}
                    sub="Archived"
                    color="purple"
                    labelOverride="完全完了 (Archived)"
                    onClick={() => setShowArchivedModal(true)}
                />
            </div>

            {/* Archived Tasks Modal */}
            <ArchivedTasksModal 
                isOpen={showArchivedModal}
                onClose={() => setShowArchivedModal(false)}
                tasks={archivedTasks}
            />

            {/* Drill Down Modal (Existing) */}
            {activeDrillDown && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setActiveDrillDown(null)}>
                    <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2 capitalize">
                                <Layers size={20} className="text-indigo-400" />
                                {activeDrillDown} Tasks ({drillDownTasks.length})
                            </h3>
                             <button onClick={() => setActiveDrillDown(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {drillDownTasks.map(t => (
                                <div 
                                    key={t.id} 
                                    className="p-3 bg-zinc-950/50 border border-white/5 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                    onClick={() => onTaskClick(t)}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="font-bold text-sm text-zinc-200 group-hover:text-indigo-300 transition-colors">{t.title}</div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                                            t.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                            t.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                            'bg-zinc-800 text-zinc-500 border-white/5'
                                        }`}>{t.status}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                                        <div className="flex items-center gap-1 text-zinc-400">
                                            <Briefcase size={10} />
                                            {t.threadTitle}
                                        </div>
                                         {t.dueDate && (
                                            <div className="flex items-center gap-1">
                                                <CalendarIcon size={10} />
                                                {format(new Date(t.dueDate), "yyyy/M/d")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {drillDownTasks.length === 0 && (
                                <div className="text-center py-10 text-zinc-600">タスクはありません</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Activity Log (Graph) */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-indigo-400" size={20} />
                    アクティビティ推移 (作成 vs 完了)
                </h3>
                <div className="h-48 flex items-end gap-2 xl:gap-4 px-2 relative">
                     {/* Legend */}
                    <div className="absolute top-0 right-0 flex items-center gap-4 text-[10px] font-bold">
                        <div className="flex items-center gap-2 text-indigo-300">
                             <div className="w-2 h-2 rounded-full bg-indigo-500" /> Created
                        </div>
                        <div className="flex items-center gap-2 text-emerald-300">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" /> Done (Updated)
                        </div>
                    </div>

                    {metrics.activityData.map((d, i) => {
                        const hCreated = (d.created / metrics.maxActivity) * 100;
                        const hCompleted = (d.completed / metrics.maxActivity) * 100;
                        
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                <div className="w-full h-32 flex items-end justify-center gap-0.5 relative">
                                    {/* Created Bar */}
                                     <div 
                                        className="w-3 bg-indigo-500/80 hover:bg-indigo-400 rounded-t-sm transition-all"
                                        style={{ height: `${hCreated}%` }}
                                        title={`Created: ${d.created}`}
                                    />
                                    {/* Completed Bar */}
                                    <div 
                                        className="w-3 bg-emerald-500/80 hover:bg-emerald-400 rounded-t-sm transition-all"
                                        style={{ height: `${hCompleted}%` }}
                                        title={`Completed: ${d.completed}`}
                                    />
                                </div>
                                <span className="text-[10px] text-zinc-500 font-medium rotate-0 whitespace-nowrap">
                                    {format(d.date, "M/d")}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Status Distribution */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex flex-col items-center">
                    <h3 className="text-lg font-bold text-white mb-6 w-full flex items-center gap-2">
                        <BarChart3 className="text-zinc-400" size={20} />
                        ステータス内訳
                    </h3>
                    <div className="relative w-56 h-56 rounded-full flex items-center justify-center mask-image" style={donutStyle}>
                        <div className="absolute inset-4 bg-[#09090b] rounded-full flex flex-col items-center justify-center z-10 shadow-inner border border-white/5">
                            <span className="text-4xl font-black text-white">{metrics.total}</span>
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">TOTAL</span>
                        </div>
                    </div>
                </div>

                {/* 2. Thread Health (List) */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm lg:col-span-1 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Layers className="text-zinc-400" size={20} />
                        スレッド状況 (Top 5)
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                         {metrics.threadHealth.map(t => (
                             <div key={t.title} className="p-3 bg-zinc-950/30 border border-white/5 rounded-2xl hover:bg-white/5 transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-bold text-sm text-zinc-200 truncate pr-2" title={t.title}>{t.title}</div>
                                    <div className="text-[10px] font-bold text-zinc-500">{t.total} tasks</div>
                                </div>
                                <div className="flex items-center gap-1 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                     <div className="h-full bg-emerald-500" style={{ width: `${(t.done/t.total)*100}%` }} />
                                     <div className="h-full bg-amber-500" style={{ width: `${(t.inProgress/t.total)*100}%` }} />
                                </div>
                             </div>
                         ))}
                    </div>
                </div>

                {/* 3. Ageing & Upcoming */}
                <div className="flex flex-col gap-6">
                    
                    {/* Active Task Ageing */}
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex-1">
                        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                            <Clock className="text-zinc-400" size={18} />
                            滞留状況 (Active)
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-zinc-950/50 rounded-xl py-3 border border-emerald-500/10 text-center">
                                <div className="text-xl font-black text-emerald-400">{metrics.ageingBuckets.week}</div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase">7日以内</div>
                            </div>
                            <div className="bg-zinc-950/50 rounded-xl py-3 border border-amber-500/10 text-center">
                                <div className="text-xl font-black text-amber-400">{metrics.ageingBuckets.month}</div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase">8-30日</div>
                            </div>
                            <div className="bg-zinc-950/50 rounded-xl py-3 border border-red-500/10 text-center">
                                <div className="text-xl font-black text-red-400">{metrics.ageingBuckets.old}</div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase">30日+</div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming */}
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex-[1.5]">
                        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                            <CalendarIcon className="text-zinc-400" size={18} />
                            直近の期限
                        </h3>
                        <div className="space-y-2">
                            {metrics.upcoming.length > 0 ? metrics.upcoming.map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => onTaskClick(t)}
                                    className="w-full flex items-center justify-between p-2 bg-zinc-950/30 border border-white/5 rounded-lg hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left group"
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="truncate text-xs font-bold text-zinc-300 group-hover:text-indigo-200 transition-colors">{t.title}</div>
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                            <Briefcase size={10} />
                                            <span className="truncate">{t.threadTitle}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-500 whitespace-nowrap bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
                                        {t.dueDate ? format(new Date(t.dueDate), "M/d") : '-'}
                                    </div>
                                </button>
                            )) : (
                                <div className="p-4 text-center text-zinc-600 text-xs border border-dashed border-white/5 rounded-lg">直近のタスクなし</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function KPICard({icon, label, value, sub, color, labelOverride, onClick}: {icon: any, label: string, value: string | number, sub: string, color: string, labelOverride?: string, onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={`bg-zinc-900/40 border border-white/5 p-5 rounded-3xl relative overflow-hidden group hover:bg-zinc-900/60 transition-colors h-full ${onClick ? 'cursor-pointer' : ''}`}
        >
           <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl bg-${color}-500/10`}>
                    {icon}
                </div>
                <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">{labelOverride || label}</span>
           </div>
           <div className="text-3xl font-black text-white mb-1">{value}</div>
           <div className="text-[10px] text-zinc-500 font-bold">{sub}</div>
        </div>
    );
}
