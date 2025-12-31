"use client";

import { useActionState } from "react";
// @ts-ignore - useActionState is available in React 19 / Next 15+ canary/rc, trying safe import or useFormState
import { useFormState } from "react-dom";
import Link from "next/link";
import { createThread, ThreadActionState } from "@/app/actions/thread";
import styles from "./dashboard.module.css";

const initialState: ThreadActionState = {
  success: false,
  message: "",
  code: ""
};

export default function CreateThreadModal() {
  const [state, formAction] = useFormState<ThreadActionState, FormData>(createThread, initialState);

  return (
      <div className={styles.modalOverlay}>
          <div className={styles.modal}>
              <h2 className={styles.sectionTitle} style={{ marginBottom: '1rem' }}>新規プロジェクト作成</h2>
              
              {state?.message && (
                  <div style={{ 
                      padding: '12px', 
                      background: '#fee2e2', 
                      color: '#dc2626', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      fontSize: '0.875rem'
                  }}>
                      <div style={{ fontWeight: 'bold' }}>エラー ({state.code || "UNKNOWN"})</div>
                      <div>{state.message}</div>
                  </div>
              )}

              <form action={formAction}>
                  <div style={{ marginBottom: '1rem' }}>
                      <label className="label">タイトル</label>
                      <input name="title" className="input" placeholder="例: 文化祭企画会議" required />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                      <label className="label">説明</label>
                      <textarea name="description" className="input" placeholder="目的や目標を入力..." style={{ resize: 'none', height: '80px' }}></textarea>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link href="/dashboard" className="btn btn-outline">キャンセル</Link>
                      <button type="submit" className="btn btn-primary">作成する</button>
                  </div>
              </form>
          </div>
      </div>
  );
}
