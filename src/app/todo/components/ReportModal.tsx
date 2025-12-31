"use client";

import { useState, useRef } from "react";
import { generateAIReport } from "@/app/actions/report";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { X, FileDown, Sparkles, Loader2, Calendar } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ja } from "date-fns/locale";

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [rangeType, setRangeType] = useState<"week" | "month" | "custom">("week");
    
    // Custom Date State
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const reportRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setReport(null);

        let start = new Date();
        let end = new Date();
        let title = "";

        const now = new Date();

        if (rangeType === "week") {
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfWeek(now, { weekStartsOn: 1 });
            title = "今週の活動レポート";
        } else if (rangeType === "month") {
            start = startOfMonth(now);
            end = endOfMonth(now);
            title = "今月の活動レポート";
        } else {
            // Custom
            if (!customStart || !customEnd) {
                alert("期間を選択してください");
                setLoading(false);
                return;
            }
            start = new Date(customStart);
            end = new Date(customEnd);
            // End of day
            end.setHours(23, 59, 59, 999);
            title = `活動レポート (${format(start, "M/d")} - ${format(end, "M/d")})`;
        }

        const res = await generateAIReport({
            startDate: start.getTime(),
            endDate: end.getTime(),
            title
        });

        if (res.success && res.report) {
            setReport(res.report);
        } else {
            alert("レポート生成に失敗しました: " + res.message);
        }
        setLoading(false);
    };

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        
        const canvas = await html2canvas(reportRef.current, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("activity-report.pdf");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
                 <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={20} />
                </button>
                
                <div className="flex flex-col items-center justify-center py-8 space-y-6">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <Loader2 size={40} className="text-amber-500 animate-spin-slow" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-xl font-bold text-white">メンテナンス中</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            現在、AIレポート機能はシステムメンテナンスのため<br/>一時的にご利用いただけません。
                        </p>
                        <p className="text-xs text-zinc-500">
                            ご不便をおかけしますが、再開まで今しばらくお待ちください。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
