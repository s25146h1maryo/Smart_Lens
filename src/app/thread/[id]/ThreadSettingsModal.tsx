"use client";

import { useState, useRef, useEffect } from "react";
import { Thread, UserProfile } from "@/types";
import { UIUser } from "./ThreadView";
import { addMembers, removeMember, deleteThread, updateThreadSettings } from "@/app/actions/thread";
import { getDmId } from "@/app/actions/chat";
import { useRouter } from "next/navigation";

interface ThreadSettingsModalProps {
    thread: Thread;
    users: UIUser[];
    currentUserRole?: string;
    onClose: () => void;
}

export default function ThreadSettingsModal({ thread, users, currentUserRole, onClose }: ThreadSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'members' | 'settings' | 'danger'>('members');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const router = useRouter();

    // Member Management State
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    
    // permissions
    const isOwner = thread.createdBy === users.find(u => u.id === thread.createdBy)?.id; // Simplification, need current user ID check really but role helps
    const canManage = currentUserRole === 'ROOT' || currentUserRole === 'ADMIN' || currentUserRole === 'TEACHER'; // Let's use role passed from View

    const handleAddMembers = async () => {
        if (selectedUsers.length === 0) return;
        setIsSubmitting(true);
        try {
            const res = await addMembers(thread.id, selectedUsers);
            if (!res.success) alert(res.message);
            else {
                setSelectedUsers([]);
                // Wait a bit for revalidate
                setTimeout(() => window.location.reload(), 500); // Simple reload for now to reflect state
            }
        } catch (e) {
            alert("メンバーの追加に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveMember = async (uid: string) => {
        if (!confirm("本当にこのメンバーを削除しますか？")) return;
        setIsSubmitting(true);
        try {
            const res = await removeMember(thread.id, uid);
            if (!res.success) alert(res.message);
            else {
                 setTimeout(() => window.location.reload(), 500);
            }
        } catch (e) {
            alert("メンバーの削除に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteThread = async () => {
        if (!confirm("本当にこのスレッドを削除しますか？この操作は取り消せません。")) return;
        if (prompt("確認のため、スレッド名を入力してください") !== thread.title) {
            alert("スレッド名が一致しません");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await deleteThread(thread.id);
            if (!res.success) alert(res.message);
            else {
                router.push("/dashboard");
            }
        } catch (e) {
            alert("スレッドの削除に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrivacyChange = async (hidden: boolean) => {
        if (!confirm(`Global Todoへの表示設定を変更しますか？\n\n${hidden ? "非表示にする: 全ユーザーのGlobal Todoからこのスレッドのタスクが消えます。" : "表示する: 全ユーザーのGlobal Todoにこのスレッドのタスクが表示されます。"}`)) return;
        
        setIsSubmitting(true);
        try {
            const res = await updateThreadSettings(thread.id, { hiddenFromGlobalTodo: hidden });
            if (!res.success) alert(res.message);
            else {
                // Optimistic update or reload
                setTimeout(() => window.location.reload(), 500); 
            }
        } catch (e) {
            alert("設定の更新に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter available users to add (exclude current members)
    const currentMemberIds = new Set(thread.members);
    const availableUsers = users.filter(u => 
        !currentMemberIds.has(u.id) && 
        (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.nickname?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A0A15] shadow-2xl flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 p-4">
                    <h2 className="text-lg font-bold text-white">スレッド設定</h2>
                    <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 px-4 pt-4 border-b border-white/5">
                    <button 
                        onClick={() => setActiveTab('members')}
                        className={`pb-3 text-sm font-medium transition-all ${activeTab === 'members' ? 'border-b-2 border-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        メンバー管理 ({thread.members.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 text-sm font-medium transition-all ${activeTab === 'settings' ? 'border-b-2 border-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        一般設定
                    </button>
                    <button 
                        onClick={() => setActiveTab('danger')}
                        className={`pb-3 text-sm font-medium transition-all ${activeTab === 'danger' ? 'border-b-2 border-red-500 text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Danger Zone
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'members' && (
                        <div className="space-y-8">
                            {/* Add Member Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">新しいメンバーを追加</h3>
                                <div className="rounded-xl bg-zinc-900/50 p-4 border border-white/5 space-y-4">
                                    <input 
                                        type="text" 
                                        placeholder="ユーザーを検索..." 
                                        className="w-full rounded-lg bg-black/20 border border-white/10 px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto scrollbar-thin">
                                        {availableUsers.map(user => {
                                            const isSelected = selectedUsers.includes(user.id);
                                            return (
                                                <div 
                                                    key={user.id}
                                                    onClick={() => setSelectedUsers(prev => isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id])}
                                                    className={`
                                                        cursor-pointer flex items-center gap-2 rounded-lg p-2 transition-all border
                                                        ${isSelected ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-black/20 border-transparent hover:bg-white/5'}
                                                    `}
                                                >
                                                    <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                                                        {(user.nickname?.[0] || user.name?.[0] || "U").toUpperCase()}
                                                    </div>
                                                    <span className={`text-xs truncate ${isSelected ? 'text-indigo-200' : 'text-zinc-400'}`}>
                                                        {user.nickname || user.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {availableUsers.length === 0 && (
                                            <div className="col-span-full py-2 text-center text-xs text-zinc-600">
                                                ユーザーが見つかりません
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <button 
                                            onClick={handleAddMembers}
                                            disabled={selectedUsers.length === 0 || isSubmitting}
                                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-indigo-500 transition-all"
                                        >
                                            {selectedUsers.length} 人を追加
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Current Members List */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">参加メンバー</h3>
                                <div className="space-y-2">
                                    {thread.members.map(mid => {
                                        const user = users.find(u => u.id === mid);
                                        const isOwner = thread.createdBy === mid;
                                        return (
                                            <div 
                                                key={mid} 
                                                onClick={async () => {
                                                    // Navigate to DM with this user
                                                    // V12.5: Faster navigation using uid param
                                                    router.push(`/messages?uid=${mid}`);
                                                }}
                                                className="flex items-center justify-between rounded-xl bg-zinc-900/30 border border-white/5 p-3 cursor-pointer hover:bg-zinc-800/50 hover:border-indigo-500/20 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:text-indigo-300 transition-colors">
                                                        {(user?.nickname?.[0] || user?.name?.[0] || "?").toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white flex items-center gap-2 group-hover:text-indigo-200 transition-colors">
                                                            {user?.nickname || user?.name || "Unknown User"}
                                                            {isOwner && <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">OWNER</span>}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">Click to DM</div>
                                                    </div>
                                                </div>
                                                
                                                {canManage && !isOwner && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(mid); }}
                                                        disabled={isSubmitting}
                                                        className="text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-all"
                                                    >
                                                        除外
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">プライバシー設定</h3>
                                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!!thread.hiddenFromGlobalTodo}
                                            onChange={(e) => handlePrivacyChange(e.target.checked)}
                                            disabled={isSubmitting || (!isOwner && currentUserRole !== 'ROOT' && currentUserRole !== 'ADMIN')}
                                            className="mt-1 w-4 h-4 accent-indigo-500 bg-zinc-800 border-zinc-600 rounded disabled:opacity-50"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-white block">Global Todoに表示しない</span>
                                            <span className="text-xs text-zinc-500 block mt-0.5">
                                                チェックを入れると、このスレッドのタスクは全ユーザーのGlobal Todoリスト（一覧画面）に表示されなくなります。
                                                現在: {thread.hiddenFromGlobalTodo ? <span className="text-amber-500 font-bold">非表示</span> : <span className="text-emerald-500 font-bold">表示中</span>}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'danger' && (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-red-400 mb-1">スレッドを削除</h3>
                                    <p className="text-xs text-red-300/60">
                                        一度削除すると元に戻せません。チャット履歴や添付ファイルへのアクセスも失われる可能性があります。
                                    </p>
                                </div>
                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleDeleteThread}
                                        disabled={isSubmitting}
                                        className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        スレッドを完全に削除
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
