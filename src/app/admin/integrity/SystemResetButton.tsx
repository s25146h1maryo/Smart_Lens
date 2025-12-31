"use client";

import { useState, useTransition } from "react";
import { resetSystem } from "@/app/actions/admin_reset";
import { useRouter } from "next/navigation";

export function SystemResetButton() {
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleReset = () => {
        if (input !== "RESET") return;
        
        if (!confirm("WARNING: This will delete ALL users, files, and threads. Are you absolutely sure?")) return;

        startTransition(async () => {
            const res = await resetSystem();
            if (res.success) {
                alert("System Reset Complete. Redirecting to Login...");
                router.push("/api/auth/signout");
            } else {
                alert("Reset Failed: " + res.errors?.join(", "));
            }
        });
    };

    return (
        <div className="bg-red-950/20 border border-red-500/20 p-6 rounded-2xl mt-8">
            <h3 className="text-xl font-bold text-red-500 mb-2">⚠️ Danger Zone: System Reset</h3>
            <p className="text-red-400/70 text-sm mb-4">
                This will delete <b className="text-red-400">ALL DATA</b> (Users, Files, Threads, Logs) and perform a hard reset. 
                Use this only for development.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <input 
                    type="text" 
                    placeholder="Type 'RESET' to confirm" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="bg-black/40 border border-red-500/30 rounded-lg px-4 py-2 text-white placeholder-red-500/30 focus:outline-none focus:border-red-500 w-full sm:w-auto"
                />
                
                <button 
                    onClick={handleReset}
                    disabled={input !== "RESET" || isPending}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {isPending ? "Resetting..." : "💣 Execute Reset"}
                </button>
            </div>
        </div>
    );
}
