import { signOut } from "@/auth";
import styles from "../pending/pending.module.css";
import { Ban, RefreshCw } from "lucide-react";

export default async function RejectedPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Ban size={40} className="text-red-400" />
          </div>
        </div>
        <h1 className={styles.title} style={{ color: '#ef4444' }}>完全に拒否されました</h1>
        <p className={styles.message}>
          あなたのアカウントリクエストは管理者によって拒否されました。<br/>
          このアプリケーションへのアクセス権はありません。<br/><br/>
          アクセス権を再度リクエストする場合は、以下のボタンからログアウトし、
          再度ログインしてください。
        </p>
        
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className={styles.button} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <RefreshCw size={16} />
            ログアウトして再リクエスト
          </button>
        </form>
      </div>
    </div>
  );
}

