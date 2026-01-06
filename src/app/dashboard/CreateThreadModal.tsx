"use client";

import { createThread, ThreadActionState } from "@/app/actions/thread";
import { getActiveUsers } from "@/app/actions/user";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

const initialState: ThreadActionState = {
  success: false,
  message: "",
  code: ""
};

type UserOption = { id: string; name: string; nickname?: string };

export default function CreateThreadModal({ onClose }: { onClose?: () => void }) {
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

    // Handle Close if success
    useEffect(() => {
        if (state.success && onClose) {
            onClose();
        }
    }, [state.success, onClose]);

    const toggleMember = (uid: string) => {
        setSelectedMembers(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>新規プロジェクト作成</h2>
                    {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>}
                </div>
                
                {state.message && (
                    <div style={{ 
                        padding: '12px', 
                        background: state.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        color: state.success ? '#34d399' : '#f87171',
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        fontSize: '0.875rem'
                    }}>
                        {state.message}
                    </div>
                )}

                <form action={formAction}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">タイトル</label>
                        <input name="title" className="input" placeholder="例: 文化祭企画会議" required />
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">説明</label>
                        <textarea name="description" className="input" placeholder="目的や目標を入力..." style={{ resize: 'none', height: '60px' }}></textarea>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                name="hiddenFromGlobalTodo" 
                                value="true"
                                className="mt-1 w-4 h-4 accent-indigo-500"
                            />
                            <div>
                                <span className="text-sm font-medium text-white block">Global Todoに表示しない</span>
                                <span className="text-xs text-zinc-500 block mt-0.5">
                                    チェックを入れると、このスレッドのタスクは全ユーザーのGlobal Todoリストに表示されなくなります。
                                </span>
                            </div>
                        </label>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="label">メンバー招待 ({selectedMembers.length}名)</label>
                        <div style={{ 
                            height: '150px', 
                            overflowY: 'auto', 
                            background: 'rgba(0,0,0,0.2)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '8px',
                            padding: '8px'
                        }}>
                            {loadingUsers ? (
                                <p style={{ color: '#666', fontSize: '0.8rem', textAlign: 'center' }}>読み込み中...</p>
                            ) : users.length === 0 ? (
                                <p style={{ color: '#666', fontSize: '0.8rem', textAlign: 'center' }}>ユーザーが見つかりません</p>
                            ) : (
                                users.map(user => (
                                    <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }} className="hover:bg-white/5">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMembers.includes(user.id)}
                                            onChange={() => toggleMember(user.id)}
                                            style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', color: selectedMembers.includes(user.id) ? '#fff' : '#aaa' }}>{user.nickname || user.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        {/* Important: Send JSON string of members */}
                        <input type="hidden" name="members" value={JSON.stringify(selectedMembers)} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {onClose && <button type="button" onClick={onClose} className="btn btn-outline">キャンセル</button>}
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
        <button type="submit" disabled={pending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50">
            {pending ? "作成中..." : "作成する"}
        </button>
    );
}
