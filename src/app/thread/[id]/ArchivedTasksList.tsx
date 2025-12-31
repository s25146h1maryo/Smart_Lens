import { Task } from "@/types";
import { restoreTask, deleteTaskPermanent, deleteAllArchivedTasks } from "@/app/actions/task";
import { RefreshCw, Trash2, Archive, Loader2, X } from "lucide-react";
import { useState } from "react";

interface ArchivedTasksListProps {
    tasks: Task[];
    threadId?: string; // Optional: If provided, enables "Delete All" for this thread
}

export function ArchivedTasksList({ tasks, threadId }: ArchivedTasksListProps) {
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleRestore = async (task: Task) => {
        setProcessingId(task.id);
        try {
            await restoreTask(task.id, task.threadId);
        } catch (e) {
            console.error("Restore failed", e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (task: Task) => {
        if (!confirm("本当に完全に削除しますか？復元できません。")) return;
        setProcessingId(task.id);
        try {
            await deleteTaskPermanent(task.id, task.threadId);
        } catch (e) {
             console.error("Delete failed", e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteAll = async () => {
        if (!threadId) return;
        if (!confirm("完了済みタスクを全て完全に削除しますか？こ操作は取り消せません。")) return;
        setIsDeletingAll(true);
        try {
             await deleteAllArchivedTasks(threadId);
        } catch (e) {
             console.error("Batch delete failed", e);
        } finally {
            setIsDeletingAll(false);
        }
    };

    if (tasks.length === 0) {
        return <div className="text-zinc-500 text-sm text-center py-8">アーカイブされたタスクはありません</div>;
    }

    return (
        <div className="space-y-4">
            {threadId && tasks.length > 0 && (
                <div className="flex justify-end">
                    <button 
                        onClick={handleDeleteAll}
                        disabled={isDeletingAll}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                        {isDeletingAll ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        完了タスクを全削除
                    </button>
                </div>
            )}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {tasks.map(task => (
                    <div key={task.id} className="group flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="text-sm font-medium text-zinc-400 truncate line-through opacity-70 group-hover:opacity-100 transition-opacity">
                                {task.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded border border-white/5">
                                    {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "-"}
                                </span>
                                {/* In Global View, show Thread Name potentially? */}
                                {/* But for now let's keep it simple as requested */}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleRestore(task)}
                                disabled={!!processingId}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 border border-emerald-500/20 transition-all"
                                title="未完了に戻す"
                            >
                                {processingId === task.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                <span className="hidden sm:inline">復元</span>
                            </button>
                            <button
                                onClick={() => handleDelete(task)}
                                disabled={!!processingId}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-50 border border-red-500/20 transition-all"
                                title="完全に削除"
                            >
                                <Trash2 size={12} />
                                <span className="hidden sm:inline">削除</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ArchivedTasksModalProps extends ArchivedTasksListProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ArchivedTasksModal({ isOpen, onClose, ...props }: ArchivedTasksModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] pointer-events-none" />
                
                <div className="flex items-center justify-between mb-6 relative">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Archive className="text-purple-500" />
                        完全完了タスク
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <ArchivedTasksList {...props} />
            </div>
        </div>
    );
}
