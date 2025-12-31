"use client";

import { createThread, ThreadActionState } from "@/app/actions/thread";
import { getActiveUsers } from "@/app/actions/user";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useState } from "react";

const initialState: ThreadActionState = {
  success: false,
  message: "",
  code: ""
};

type UserOption = { id: string; name: string; nickname?: string };

export default function CreateThreadModal({ onClose }: { onClose: () => void }) {
    // @ts-ignore
    const [state, formAction] = useFormState(createThread, initialState);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    useEffect(() => {
        getActiveUsers().then(data => {
            setUsers(data.map(u => ({ id: u.id, name: u.name, nickname: u.nickname })));
            setLoadingUsers(false);
        }).catch(err => {
            console.error("Failed to fetch users", err);
            setLoadingUsers(false);
        });
    }, []);

    useEffect(() => {
        if (state.success) {
            onClose();
        }
    }, [state, onClose]);

    const toggleMember = (uid: string) => {
        setSelectedMembers(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-[500px] max-w-[90%] text-white shadow-2xl">
                <h3 className="text-xl font-bold mb-4">新規スレッド作成</h3>
                
                {state.message && (
                     <div className={`text-sm mb-4 p-3 rounded ${state.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                         {state.message}
                     </div>
                )}

                <form action={formAction} className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm text-zinc-400 mb-1 block">スレッド名 (プロジェクト名)</label>
                        <input name="title" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 focus:border-indigo-500 outline-none transition-colors" required placeholder="例: 文化祭実行委員会" />
                    </div>

                    {/* Hidden Description Field (Empty defaults) */}
                    <input type="hidden" name="description" value="" />

                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                name="hiddenFromGlobalTodo" 
                                value="true"
                                className="mt-1 w-4 h-4 accent-indigo-500 bg-zinc-800 border-zinc-600 rounded"
                            />
                            <div>
                                <span className="text-sm font-medium text-zinc-300 block">Global Todoに表示しない</span>
                                <span className="text-xs text-zinc-500 block mt-0.5">
                                    チェックを入れると、このスレッドのタスクは全ユーザーのGlobal Todoリスト（一覧画面）に表示されなくなります。
                                    機密性の高いプロジェクトに推奨します。
                                </span>
                            </div>
                        </label>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">メンバー招待</label>
                        <div className="h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-2 space-y-1">
                            {loadingUsers ? (
                                <p className="text-xs text-zinc-500 p-2">ユーザー読み込み中...</p>
                            ) : users.length === 0 ? (
                                <p className="text-xs text-zinc-500 p-2">ユーザーが見つかりません</p>
                            ) : (
                                users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-zinc-900 rounded cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            value={user.id} 
                                            // We won't use name="members" because form action handles strings nicely, but arrays are tricky with simple FormData sometimes.
                                            // Better to just push to a hidden input as JSON string.
                                            checked={selectedMembers.includes(user.id)}
                                            onChange={() => toggleMember(user.id)}
                                            className="accent-indigo-500 w-4 h-4" 
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm text-zinc-300 group-hover:text-white">{user.nickname || user.name}</span>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <input type="hidden" name="members" value={JSON.stringify(selectedMembers)} />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">
                            キャンセル
                        </button>
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </div>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={pending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2">
            {pending ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    作成中...
                </>
            ) : (
                "作成"
            )}
        </button>
    );
}
