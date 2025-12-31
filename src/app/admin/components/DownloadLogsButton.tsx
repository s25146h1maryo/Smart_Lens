"use client";

import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { downloadLogsCsv } from "@/app/actions/log_download";

export default function DownloadLogsButton() {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        try {
            setLoading(true);
            const csvData = await downloadLogsCsv();
            
            // Create Blob and trigger download
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `system_logs_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed:", error);
            alert("ログのダウンロードに失敗しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-all border border-white/5 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
            {loading ? (
                <Loader2 size={16} className="animate-spin" />
            ) : (
                <FileText size={16} className="group-hover:text-indigo-400 transition-colors" />
            )}
            <span>システムログ (CSV)</span>
        </button>
    );
}
