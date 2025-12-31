export default function Loading() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#050510]">
            <div className="relative">
                {/* Outer Ring */}
                <div className="h-12 w-12 rounded-full border-4 border-white/5 border-t-indigo-500 animate-spin"></div>
                {/* Inner Glow */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                </div>
            </div>
        </div>
    );
}
