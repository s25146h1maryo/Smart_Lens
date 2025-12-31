import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";

export default async function VotePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 flex flex-col items-center text-center max-w-md">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 text-amber-500">
                    <Wrench size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">開発中</h1>
                <p className="text-sm">投票結果分析支援システムは現在開発中です。<br/>しばらくお待ちください。</p>
            </div>
        </div>
    );
}
