"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { updateProfile } from "@/app/actions/user";

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const [nickname, setNickname] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (session?.user) {
            setNickname(session.user.name || "");
        }
    }, [session]);

    const handleSave = async () => {
        if (!nickname.trim()) {
            alert("表示名は必須です。");
            return;
        }

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append("nickname", nickname);

            const res = await updateProfile(formData);

            if (res.success) {
                await update({ name: nickname }); // Client update
                alert("保存しました！");
            } else {
                alert("保存に失敗しました: " + res.message);
            }
        } catch (e) {
            console.error(e);
            alert("予期せぬエラーが発生しました。");
        } finally {
            setIsSaving(false);
        }
    };

    if (!session) return <div className="p-10 text-white">読み込み中...</div>;

    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold text-white mb-8">設定</h1>
            
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-8">
                {/* Profile Section */}
                <section className="space-y-6">
                    <h2 className="text-xl font-semibold text-white">プロフィール</h2>
                    
                    <div className="grid gap-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">表示名</label>
                            <input 
                                type="text" 
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="山田 太郎"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">役職 / 役割</label>
                            <div className="w-full bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-400">
                                {session.user.jobTitle || "未設定"}
                                <span className="text-xs text-zinc-600 ml-2">(管理者のみ変更可)</span>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button 
                                onClick={handleSave}
                                disabled={isSaving || !nickname.trim()}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "保存中..." : "変更を保存"}
                            </button>
                        </div>
                    </div>
                </section>

                <hr className="border-white/5" />

                {/* Account Actions */}
                <section>
                    <h2 className="text-xl font-semibold text-red-400 mb-4">アカウント</h2>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div className="text-white font-medium">ログアウト</div>
                            <div className="text-sm text-zinc-400">アカウントからサインアウトします</div>
                        </div>
                        <button 
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            ログアウト
                        </button>
                    </div>
                </section>
            </div>
            
            <div className="mt-4 text-center text-xs text-zinc-500">
                User ID: {session.user.id} <br/>
                Email: {session.user.email} <br/>
                Role: {session.user.role}
            </div>
        </div>
    );
}
