import Link from "next/link";
import { WifiOff, Home } from "lucide-react";

export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-md">
                <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
                    <WifiOff size={40} className="text-amber-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4">オフラインです</h1>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                    インターネット接続が確認できません。<br/>
                    データの整合性を保つため、ダッシュボード以外の機能は<br/>
                    オンライン時のみご利用いただけます。
                </p>
                <Link 
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors"
                >
                    <Home size={18} />
                    ダッシュボードへ
                </Link>
            </div>
        </div>
    );
}
