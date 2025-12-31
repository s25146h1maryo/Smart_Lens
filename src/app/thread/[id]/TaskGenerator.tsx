"use client";

import { useState, useTransition } from "react";
import { getUploadSession } from "@/app/actions/thread";
import { analyzeDriveImage, SuggestedTask } from "@/app/actions/ai_task";
import { createTask } from "@/app/actions/task";
import styles from "./thread.module.css";

export default function TaskGenerator({ threadId }: { threadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("Idle"); // Idle, Uploading, Analyzing, Review, Error
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          setStatus("アップロード中...");
          // 1. Upload to Drive
          const uploadUrl = await getUploadSession(threadId, `AI_Source_${file.name}`, file.type);
          
          if (!uploadUrl) throw new Error("Upload URL generation failed");
          
          const res = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
          });

          if (!res.ok) throw new Error("Upload Failed");
          const driveFile = await res.json();

          setStatus("AI解析中 (Gemini 2.0)...");
          
          // 2. Analyze
          const tasks = await analyzeDriveImage(driveFile.id, file.type);
          
          if (tasks.length === 0) {
            setSuggestions([]);
            setStatus("タスクが見つかりませんでした。別の画像を試してください。");
            return;
          }

          setSuggestions(tasks);
          setStatus("Review");

      } catch (e) {
          console.error(e);
          setStatus("エラーが発生しました");
      }
  };

  const handleApprove = async (task: SuggestedTask, index: number) => {
      // Create Task
      await createTask(threadId, task.title); 
      // Remove from suggestions
      setSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleApproveAll = async () => {
      setStatus("作成中...");
      for (const task of suggestions) {
          await createTask(threadId, task.title);
      }
      setSuggestions([]);
      setStatus("Idle");
  };

  return (
    <div className={styles.generatorCard} style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
        { (status === "Idle" || status.includes("エラー") || status.includes("見つかりませんでした")) && (
             <div 
                className={styles.dropZone} 
                style={{ padding: '40px', border: '2px dashed var(--primary)', background: 'var(--bg-subtle)', cursor: 'pointer' }}
                onClick={() => document.getElementById('ai-upload')?.click()}
             >
                <input id="ai-upload" type="file" accept="image/*,application/pdf" hidden onChange={handleUpload} />
                <div style={{ pointerEvents: 'none', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</div>
                    <div>ここに画像をドロップ<br/>またはクリックしてアップロード</div>
                </div>
             </div>
        )}
        
        {status !== "Idle" && status !== "Review" && !status.includes("エラー") && !status.includes("見つかりませんでした") && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                {status}
            </div>
        )}
        
        {(status.includes("エラー") || status.includes("見つかりませんでした")) && (
             <div style={{ padding: '16px', color: '#dc2626', background: '#fee2e2', borderRadius: '8px', marginTop: '16px', textAlign: 'center' }}>
                {status}
             </div>
        )}

        {status === "Review" && (
            <div>
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{suggestions.length}件の提案</span>
                    <button onClick={handleApproveAll} className="btn-xs" style={{ background: 'var(--primary)', color: 'white' }}>すべて追加</button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {suggestions.map((task, i) => (
                        <div key={i} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{task.title}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>{task.description}</div>
                            <div style={{ marginTop: '4px', textAlign: 'right' }}>
                                <button onClick={() => handleApprove(task, i)} className="btn-xs">追加</button>
                            </div>
                        </div>
                    ))}
                    {suggestions.length === 0 && <div>全て追加されました！</div>}
                </div>
                <button onClick={() => setStatus("Idle")} style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}>
                    キャンセル
                </button>
            </div>
        )}
    </div>
  );
}
