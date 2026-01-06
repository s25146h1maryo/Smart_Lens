"use client";

import { useState } from "react";
import { testMorningSummary, testAttendanceSummary } from "@/app/actions/notifications";
import { Loader2, Bell, CheckCircle2, AlertCircle } from "lucide-react";

export function NotificationTester() {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleTest = async (type: 'morning' | 'attendance', target: 'me' | 'all') => {
        setLoading(`${type}-${target}`);
        setResult(null);

        try {
            let res;
            if (type === 'morning') {
                res = await testMorningSummary(target);
            } else {
                res = await testAttendanceSummary(target);
            }

            setResult({
                success: true,
                message: `送信成功: ${res.count}件` + (res.body ? `\n\n${res.body}` : "")
            });
        } catch (e: any) {
            setResult({
                success: false,
                message: `エラー: ${e.message}`
            });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bell size={18} className="text-zinc-400" />
                通知機能テスト (実行者: ROOT)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Morning Summary */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-zinc-400">🌞 今日のタスク (朝のサマリー)</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTest('morning', 'me')}
                            disabled={!!loading}
                            className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {loading === 'morning-me' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "自分に送信"}
                        </button>
                        <button
                            onClick={() => {
                                if (confirm("本当に全員に送信しますか？")) handleTest('morning', 'all');
                            }}
                            disabled={!!loading}
                            className="flex-1 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-bold border border-red-500/20 transition-all disabled:opacity-50"
                        >
                            {loading === 'morning-all' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "全員に送信 (Broadcast)"}
                        </button>
                    </div>
                </div>

                {/* Attendance Summary */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-zinc-400">🏫 出席状況 (夕方のサマリー)</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTest('attendance', 'me')}
                            disabled={!!loading}
                            className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {loading === 'attendance-me' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "自分に送信"}
                        </button>
                         <button
                            onClick={() => {
                                if (confirm("本当に全員に送信しますか？")) handleTest('attendance', 'all');
                            }}
                            disabled={!!loading}
                            className="flex-1 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-bold border border-red-500/20 transition-all disabled:opacity-50"
                        >
                            {loading === 'attendance-all' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "全員に送信 (Broadcast)"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Result Display */}
            {result && (
                <div className={`mt-4 p-4 rounded-xl border text-xs whitespace-pre-wrap ${result.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                    <div className="flex items-center gap-2 mb-1 font-bold">
                        {result.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {result.success ? "送信完了" : "送信エラー"}
                    </div>
                    {result.message}
                </div>
            )}
        </div>
    );
}
