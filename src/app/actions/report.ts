"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAllTasks, getWorkloadData } from "./global_todo";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ReportConfig {
    startDate: number;
    endDate: number;
    title?: string;
}

export async function generateAIReport(config: ReportConfig) {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, message: "API Key not found" };
    }

    try {
        // 1. Gather Data
        const allTasks = await getAllTasks();
        const rangeTasks = allTasks.filter(t => {
            const d = t.updatedAt || t.createdAt || 0;
            return d >= config.startDate && d <= config.endDate;
        });

        const completedTasks = rangeTasks.filter(t => t.status === 'done');
        const createdTasks = rangeTasks.filter(t => t.createdAt && t.createdAt >= config.startDate && t.createdAt <= config.endDate);
        const inProgressTasks = rangeTasks.filter(t => t.status === 'in-progress');

        // Workload within this period (approximate, using current workload snapshot for simplicity or re-calc)
        // Ideally we recalc based on filtered tasks.
        const memberStats: Record<string, { name: string, done: number, added: number }> = {};
        
        rangeTasks.forEach(task => {
            task.assigneeIds?.forEach(uid => { // Note: We need user names map, or fetch workload data
                 if (!memberStats[uid]) memberStats[uid] = { name: "Unknown", done: 0, added: 0 };
                 if (task.status === 'done' && task.updatedAt && task.updatedAt >= config.startDate) {
                     memberStats[uid].done++;
                 }
                 if (task.createdAt && task.createdAt >= config.startDate) {
                     memberStats[uid].added++;
                 }
            });
        });

        // Get Names
        const workload = await getWorkloadData();
        workload.forEach(w => {
            if (memberStats[w.userId]) {
                memberStats[w.userId].name = w.userName;
            } else if ((rangeTasks.some(t => t.assigneeIds?.includes(w.userId)))) {
                // Add even if 0 done in this period but active
                memberStats[w.userId] = { name: w.userName, done: 0, added: 0 };
            }
        });

        // 2. Build Prompt
        const filteredStats = Object.values(memberStats).filter(s => s.done > 0 || s.added > 0);
        
        const prompt = `
        あなたは優秀なプロジェクトマネージャーのアシスタントAIです。
        以下のプロジェクト活動データに基づいて、チームのための日本語の活動レポート（Markdown形式）を作成してください。

        **レポートの要件:**
        - タイトル: ${config.title || "週間活動レポート"}
        - 対象期間: ${format(config.startDate, "yyyy/MM/dd")} - ${format(config.endDate, "yyyy/MM/dd")}
        - **トーン＆マナー**: プロフェッショナルだが、チームを鼓舞するポジティブなトーン。
        - **内容**:
          1. **概要**: 全体の進捗状況の要約。
          2. **ハイライト**: 特に成果を上げたメンバーや完了した重要なタスク。
          3. **課題と対策**: 停滞しているタスクや期限切れタスクがあれば、それに対する建設的なアドバイス。
          4. **全体統計**: 完了数、新規作成数などの数字データ。
        
        **データ:**
        - 新規作成タスク数: ${createdTasks.length}
        - 完了タスク数: ${completedTasks.length}
        - 進行中タスク数: ${inProgressTasks.length}
        
        **メンバー別の成果:**
        ${filteredStats.map(s => `- ${s.name}: 完了 ${s.done}件, 新規担当 ${s.added}件`).join("\n")}

        **主な完了タスク:**
        ${completedTasks.slice(0, 5).map(t => `- [${t.threadTitle}] ${t.title}`).join("\n")}

        **期限切れ/注意が必要なタスク:**
        ${rangeTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < Date.now()).slice(0, 5).map(t => `- [${t.threadTitle}] ${t.title}`).join("\n")}
        `;

        // 3. Call Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return { success: true, report: text };

    } catch (e: any) {
        console.error("AI Report Generation Failed:", e);
        return { success: false, message: e.message || "Failed to generate report" };
    }
}
