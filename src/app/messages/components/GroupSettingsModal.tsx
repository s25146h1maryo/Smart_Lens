"use client";

import { useState } from "react";
import { addMembersToGroup, leaveGroup, updateGroup, kickMember, deleteGroup } from "@/app/actions/chat";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Trash2, UserMinus, LogOut, UserPlus, Users, Settings, Lock, MessageCircle } from "lucide-react";

interface GroupSettingsModalProps {
    users: any[];
    chatId: string;
    currentName: string;
    currentParticipants: string[];
    onClose: () => void;
    threadId?: string;
}

export default function GroupSettingsModal({ users, chatId, currentName, currentParticipants, onClose, threadId }: GroupSettingsModalProps) {
    const [name, setName] = useState(currentName);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { data: session } = useSession();
    
    // Check if current user is ADMIN+
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === "ROOT" || userRole === "ADMIN" || userRole === "TEACHER";

    const availableUsers = users.filter(u => 
        !currentParticipants.includes(u.id) &&
        u.nickname !== "Unknown" && 
        u.name !== "Unknown" &&
        (u.nickname || u.name)
    );

    const currentMembers = users.filter(u => currentParticipants.includes(u.id));

    const toggleUser = (uid: string) => {
        if (selectedUserIds.includes(uid)) {
            setSelectedUserIds(prev => prev.filter(id => id !== uid));
        } else {
            setSelectedUserIds(prev => [...prev, uid]);
        }
    };

    const handleUpdateName = async () => {
        if (name === currentName) return;
        setIsLoading(true);
        try {
            await updateGroup(chatId, name);
            router.refresh();
        } catch (e) {
            alert("名前の更新に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddMembers = async () => {
        if (selectedUserIds.length === 0) return;
        setIsLoading(true);
        try {
            await addMembersToGroup(chatId, selectedUserIds);
            router.refresh();
            setIsAdding(false);
            setSelectedUserIds([]);
        } catch (e) {
            alert("メンバーの追加に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKick = async (targetUserId: string, targetName: string) => {
        if (!confirm(`${targetName} をグループから削除しますか？`)) return;
        setIsLoading(true);
        try {
            const result = await kickMember(chatId, targetUserId);
            if (result.success) {
                router.refresh();
            } else {
                alert(result.message || "削除に失敗しました");
            }
        } catch (e) {
            alert("削除に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm("このグループを完全に削除しますか？この操作は取り消せません。")) return;
        setIsLoading(true);
        try {
            const result = await deleteGroup(chatId);
            if (result.success) {
                router.push('/messages');
                router.refresh();
            } else {
                alert(result.message || "削除に失敗しました");
            }
        } catch (e) {
            alert("削除に失敗しました");
            setIsLoading(false);
        }
    };

    const handleLeave = async () => {
        if (!confirm("このグループから退出しますか？")) return;
        setIsLoading(true);
        try {
            await leaveGroup(chatId);
            router.push('/messages');
            router.refresh();
        } catch (e) {
            alert("退出に失敗しました");
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings size={20} /> グループ設定
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
                </div>

                {/* Name Edit */}
                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase font-bold flex items-center justify-between">
                        グループ名
                        {threadId && <span className="flex items-center gap-1 text-[10px] text-amber-500"><Lock size={10} /> スレッド連動中 (変更不可)</span>}
                    </label>
                    <div className="flex gap-2 relative">
                        <input 
                            className={`flex-1 bg-zinc-800 border ${threadId ? 'border-amber-500/30 text-zinc-400' : 'border-white/10 text-white'} rounded-lg px-3 py-2`}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={!!threadId}
                        />
                         {!threadId && (
                            <button 
                                onClick={handleUpdateName}
                                disabled={name === currentName || isLoading}
                                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                                保存
                            </button>
                        )}
                        {threadId && (
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                <Lock size={14} className="text-amber-500/50" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Members List with Kick */}
                <div className="space-y-2">
                     <label className="text-xs text-zinc-500 uppercase font-bold flex items-center gap-2">
                        <Users size={14} /> メンバー ({currentMembers.length})
                     </label>
                     <div className="max-h-40 overflow-y-auto space-y-1 border border-white/5 rounded-lg p-2 bg-zinc-800/30">
                         {currentMembers.map(u => {
                             const isCurrentUser = u.id === session?.user?.id;
                             return (
                                 <div key={u.id} className="text-sm text-zinc-300 flex items-center justify-between p-1.5 rounded hover:bg-white/5">
                                     <div className="flex items-center gap-2 flex-1 min-w-0">
                                         <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] shrink-0">
                                             {u.nickname?.[0] || u.name?.[0]}
                                         </div>
                                         <span className="truncate">{u.nickname || u.name}</span>
                                         {isCurrentUser && <span className="text-[10px] text-zinc-500 shrink-0">(あなた)</span>}
                                     </div>
                                     <div className="flex items-center gap-1">
                                        {!isCurrentUser && (
                                            <button
                                                onClick={() => router.push(`/messages?uid=${u.id}`)}
                                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                title="メッセージを送る"
                                            >
                                                <MessageCircle size={14} />
                                            </button>
                                        )}
                                        {isAdmin && !isCurrentUser && (
                                            <button
                                                onClick={() => handleKick(u.id, u.nickname || u.name)}
                                                disabled={isLoading || !!threadId} // Block kick if thread linked (as per server logic, and UI consistency)
                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={threadId ? "スレッド連動中は削除不可" : "メンバーを削除"}
                                            >
                                                <UserMinus size={14} />
                                            </button>
                                        )}
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                </div>

                {/* Add Members - ADMIN+ only */}
                {isAdmin && !threadId && (
                    !isAdding ? (
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg text-sm font-medium transition-colors border border-indigo-500/30 flex items-center justify-center gap-2"
                        >
                            <UserPlus size={16} /> メンバーを追加
                        </button>
                    ) : (
                        <div className="space-y-2 bg-zinc-800/50 p-3 rounded-lg border border-white/5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                 <span className="text-sm font-bold text-white">ユーザーを選択</span>
                                 <button onClick={() => setIsAdding(false)} className="text-xs text-zinc-400">キャンセル</button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                 {availableUsers.length === 0 && <p className="text-xs text-zinc-500">追加できるユーザーがいません</p>}
                                 {availableUsers.map(u => (
                                    <div 
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedUserIds.includes(u.id) ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border ${selectedUserIds.includes(u.id) ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-500'} flex items-center justify-center`}>
                                            {selectedUserIds.includes(u.id) && <span className="text-[8px] text-white">✓</span>}
                                        </div>
                                        <span className="text-sm text-zinc-200">{u.nickname || u.name}</span>
                                    </div>
                                 ))}
                            </div>
                            <button 
                                onClick={handleAddMembers}
                                disabled={selectedUserIds.length === 0 || isLoading}
                                className="w-full py-1 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
                            >
                                選択したユーザーを招待
                            </button>
                        </div>
                    )
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-white/10 space-y-2">
                    {/* Leave Group - Anyone can do this */}
                    <button 
                        onClick={handleLeave}
                        disabled={isLoading}
                        className="w-full py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-sm font-medium transition-colors border border-amber-500/30 flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} /> グループを退出
                    </button>
                    
                    {/* Delete Group - ADMIN+ only */}
                    {isAdmin && (
                        <button 
                            onClick={handleDeleteGroup}
                            disabled={isLoading}
                            className="w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} /> グループを削除
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
