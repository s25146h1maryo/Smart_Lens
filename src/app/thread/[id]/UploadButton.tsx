"use client";

import { useTransition, useState } from "react";
import { getUploadSession, refreshThread } from "@/app/actions/thread"; 
import styles from "./thread.module.css";

export default function UploadButton({ threadId }: { threadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("Idle");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("セッション取得中...");
    
    try {
        const uploadUrl = await getUploadSession(threadId, file.name, file.type);
        if (!uploadUrl) throw new Error("セッション取得失敗");

        setStatus("アップロード中...");

        const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": file.type,
            },
            body: file,
        });

        if (!res.ok) throw new Error("アップロード失敗");
        
        setStatus("更新中...");
        await refreshThread(threadId);

        setStatus("完了!");
        setTimeout(() => setStatus("Idle"), 2000);

    } catch (err) {
        console.error(err);
        setStatus("エラー発生");
    }
  };

  return (
    <div className={styles.dropZone} onClick={() => document.getElementById('file-upload')?.click()}>
      <input 
        id="file-upload" 
        type="file" 
        onChange={handleUpload} 
        style={{ display: 'none' }} 
        accept="audio/*,application/pdf,image/*" 
      />
      {status === "Idle" ? (
          <>
            <strong>クリックしてアップロード</strong>
            <div>対応: 音声(議事録), PDF, 画像</div>
          </>
      ) : (
          <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{status}</div>
      )}
    </div>
  );
}
