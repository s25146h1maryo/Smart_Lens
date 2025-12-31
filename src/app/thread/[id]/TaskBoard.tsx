"use client";

import { Task } from "@/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { updateTaskStatus } from "@/app/actions/task";
import styles from "./thread.module.css";
import { useState } from "react";
import { AlertCircle, CalendarDays, Pin, Pencil, Paperclip } from "lucide-react";
import { 
    DndContext, 
    DragOverlay, 
    closestCorners, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragStartEvent, 
    DragEndEvent,
    useDroppable
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import EditTaskModal from "@/app/components/EditTaskModal";

// Helper for Priority Styles
const getPriorityStyles = (priority?: string) => {
    switch (priority) {
        case 'high': return 'border-red-500/50 bg-red-900/10 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]';
        case 'medium': return 'border-amber-500/30 bg-amber-900/10';
        case 'low': return 'border-emerald-500/20 bg-emerald-900/5';
        default: return 'border-white/5 bg-zinc-800/80';
    }
};

const getPriorityLabel = (priority?: string) => {
    switch (priority) {
        case 'high': return { label: '高', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
        case 'medium': return { label: '中', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
        case 'low': return { label: '低', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
        default: return null;
    }
};

function SortableTask({ task, users, onEdit }: { task: Task, users: any[], onEdit: (task: Task) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none'
    };

    const priorityStyle = getPriorityStyles(task.priority);
    const priorityBadge = getPriorityLabel(task.priority);
    
    // Resolve Assignees
    const assignees = task.assigneeIds?.map(id => users.find(u => u.id === id)).filter(Boolean) || [];

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} 
             onClick={() => onEdit(task)}
             className={`group relative rounded-xl border p-4 shadow-sm transition-all hover:translate-y-[-2px] hover:shadow-lg active:cursor-grabbing cursor-pointer ${priorityStyle}`}
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="font-bold text-zinc-100 leading-snug">{task.title}</div>
                 <div className="flex items-center gap-1">
                    {priorityBadge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${priorityBadge.color}`}>
                            {priorityBadge.label}
                        </span>
                    )}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(task);
                        }}
                        className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        <Pencil size={12} />
                    </button>
                </div>
            </div>
            
            {/* Meta info */}
            <div className="space-y-3">
                {/* Assignees */}
                {assignees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {assignees.map((user: any) => (
                            <div key={user.id} className="flex items-center gap-1.5 bg-black/30 rounded-full pl-0.5 pr-2 py-0.5 border border-white/5">
                                <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] text-zinc-300">
                                    {(user.nickname?.[0] || user.name?.[0] || "?").toUpperCase()}
                                </div>
                                <span className="text-[10px] text-zinc-300 truncate max-w-[80px]">
                                    {user.nickname || user.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Date Logic */}
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                    {/* Scheduled / Period */}
                    {task.startDate && (
                        (() => {
                            const isPeriod = !!(task.endDate && task.startDate !== task.endDate);
                            const isAllDay = task.isAllDay ?? true;
                            const dateFormat = isAllDay ? 'M/d' : 'M/d HH:mm';
                            
                            const colorClass = isPeriod 
                                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" 
                                : "bg-sky-500/10 text-sky-300 border-sky-500/20";
                            const Icon = isPeriod ? CalendarDays : Pin;

                            return (
                                <div className={`flex items-center gap-1 rounded-md px-2 py-1 border ${colorClass}`} title={isPeriod ? "期間" : "予定日"}>
                                    <Icon size={10} />
                                    <span>
                                        {format(new Date(task.startDate), dateFormat, { locale: ja })}
                                        {isPeriod && ` - ${format(new Date(task.endDate!), dateFormat, { locale: ja })}`}
                                    </span>
                                </div>
                            );
                        })()
                    )}
                    
                    {/* Deadline (Due Date) */}
                    {!task.startDate && task.dueDate && (
                         (() => {
                            const isAllDay = task.isAllDay ?? true;
                            const dateFormat = isAllDay ? 'M/d' : 'M/d HH:mm';
                            
                            return (
                                <div className="flex items-center gap-1 rounded-md px-2 py-1 border bg-rose-500/10 text-rose-300 border-rose-500/20" title="Deadline">
                                    <AlertCircle size={10} />
                                    <span>
                                        期限: {format(new Date(task.dueDate), dateFormat, { locale: ja })}
                                    </span>
                                </div>
                            );
                        })()
                    )}

                    {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1">
                            <Paperclip size={10} /> <span>{task.attachments.length}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="absolute right-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100">
                 <div className="h-2 w-2 rounded-full bg-white/20"></div>
            </div>
        </div>
    );
}

function Column({ id, tasks, label, users, onEdit }: { id: string, tasks: Task[], label: string, users: any[], onEdit: (task: Task) => void }) {
    const taskIds = tasks.map(t => t.id);

    return (
        <div className="flex h-full min-w-[320px] max-w-[400px] flex-col rounded-2xl border border-white/5 bg-black/20 p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between px-1">
                <span className="font-bold text-zinc-400">{label}</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 px-1.5 text-xs font-medium text-white">
                    {tasks.length}
                </span>
            </div>
            
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                    {tasks.map(task => (
                        <SortableTask key={task.id} task={task} users={users} onEdit={onEdit} />
                    ))}
                    {tasks.length === 0 && (
                        <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-white/5 text-sm text-zinc-600">
                            ドラッグ&ドロップ
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export default function TaskBoard({ tasks, setTasks, threadId, users = [] }: { tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>, threadId: string, users?: any[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    
    // Determine target status
    let newStatus: Task['status'] | undefined;
    
    if (overId.startsWith("col-")) {
        // Dropped on a column
        newStatus = overId.replace("col-", "") as Task['status'];
    } else {
        // Dropped on another task
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
            newStatus = overTask.status;
        }
    }

    if (!activeTask || !newStatus) {
        setActiveId(null);
        return;
    }

    // Optimistic Update
    if (activeTask.status !== newStatus || activeId !== overId) {
        setTasks((prev) => {
            const activeIndex = prev.findIndex((t) => t.id === activeId);
            
            // Create new array
            let newTasks = [...prev];
            
            // Update status first
            const updatedTask = { ...activeTask, status: newStatus! };
            newTasks[activeIndex] = updatedTask;

            // If we want to support reordering within the same list/status, we need logic here.
            // For simplicity and since we operate on a single filtered list in columns, 
            // strict reordering across the whole 'tasks' array is tricky without `pos` field.
            // dnd-kit's `arrayMove` swaps indices.
            
            if (activeTask.status === newStatus && !overId.startsWith("col-")) {
                 const overIndex = prev.findIndex((t) => t.id === overId);
                 return arrayMove(newTasks, activeIndex, overIndex);
            }
            
            return newTasks;
        });

        // Server Action
        try {
            await updateTaskStatus(activeId, threadId, newStatus);
        } catch (error) {
            console.error("Failed to update task status", error);
        }
    }

    setActiveId(null);
  };

  const DroppableColumn = ({ status, label }: { status: Task['status'], label: string }) => {
      const { setNodeRef } = useDroppable({ id: `col-${status}` }); 
      const columnTasks = tasks.filter(t => t.status === status);
      
      return (
          <div ref={setNodeRef} style={{ flex: 1, minWidth: '300px' }}>
              <Column id={`col-${status}`} tasks={columnTasks} label={label} users={users} onEdit={setEditingTask} />
          </div>
      );
  };
  
  return (
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
          <div className="flex gap-6 overflow-x-auto pb-4">
              <DroppableColumn status="todo" label="未着手" />
              <DroppableColumn status="in-progress" label="進行中" />
              <DroppableColumn status="done" label="完了" />
          </div>
          
           <DragOverlay>
                {activeId ? (
                    <div className={`
                        w-[300px] cursor-grabbing rounded-xl border p-4 shadow-2xl rotate-2
                        ${getPriorityStyles(tasks.find(t => t.id === activeId)?.priority)}
                    `}>
                        <div className="mb-2 font-bold text-zinc-100">{tasks.find(t => t.id === activeId)?.title}</div>
                        <div className="h-2 w-20 rounded-full bg-zinc-700"></div>
                    </div>
                ) : null}
            </DragOverlay>

            {/* Edit Modal */}
            {editingTask && (
                <EditTaskModal 
                    task={editingTask} 
                    isOpen={!!editingTask} 
                    onClose={() => setEditingTask(null)} 
                    users={users} 
                />
            )}
      </DndContext>
  );
}
