import { signOut } from "@/auth";
import styles from "../pending/pending.module.css";

export default async function RejectedPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title} style={{ color: '#ef4444' }}>アクセスが拒否されました</h1>
        <p className={styles.message}>
          あなたのアカウントリクエストは管理者によって拒否されました。<br/>
          これ以上このアプリケーションにアクセスすることはできません。<br/><br/>
          ご質問がある場合は、管理者にお問い合わせください。
        </p>
        
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className={styles.button}>
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
