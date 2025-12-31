"use client";

import { useEffect } from "react";
import styles from "./error.module.css";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>エラーが発生しました</h1>
      <p className={styles.message}>
        申し訳ありません。予期せぬ問題が発生しました。<br/>
        一時的なサーバーの問題かもしれません。
      </p>

      {/* Debug Info */}
      <div style={{ margin: '20px 0', padding: '10px', background: '#f3f4f6', borderRadius: '4px', textAlign: 'left', maxWidth: '600px', overflowX: 'auto' }}>
          <p style={{ color: 'red', fontWeight: 'bold' }}>Debug Error: {error.message}</p>
          {error.digest && <p style={{ fontSize: '0.8rem' }}>Digest: {error.digest}</p>}
      </div>

      <div className={styles.actions}>
        <button
          className="btn btn-primary"
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          再試行
        </button>
        <a href="/dashboard" className="btn btn-outline">
          ホームへ戻る
        </a>
      </div>
    </div>
  );
}
