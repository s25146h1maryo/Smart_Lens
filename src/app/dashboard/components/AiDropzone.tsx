"use client";

export default function AiDropzone() {
    return (
        <div className="col-span-12 md:col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div 
                className="relative bg-zinc-900/50 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all duration-300 overflow-hidden h-full min-h-[300px] border-zinc-700 opacity-60"
            >
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 shadow-lg z-10">
                    <span className="text-3xl">🔧</span>
                </div>

                <h3 className="text-lg font-bold text-zinc-100 z-10">AI Task Extraction</h3>
                <div className="mt-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full">
                    <span className="text-amber-400 text-sm font-medium">メンテナンス中</span>
                </div>
                <p className="text-center text-sm text-zinc-500 mt-4 z-10 max-w-[200px]">
                    この機能は現在メンテナンス中です。しばらくお待ちください。
                </p>
            </div>
        </div>
    );
}
