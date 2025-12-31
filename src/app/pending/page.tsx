import { signOut, auth } from "@/auth";
import { updateProfileWithRedirect } from "@/app/actions/user";
import { db } from "@/lib/firebase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // Disable caching for this page
export const revalidate = 0;

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  
  // If user is not logged in, redirect to login
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch latest user data from DB to check if status has changed
  const userDoc = await db.collection("users").doc(session.user.id).get();
  const userData = userDoc.data();
  
  // If user has been approved (role changed), redirect to dashboard
  if (userData?.role && userData.role !== "PENDING") {
    if (userData.role === "REJECTED") {
      redirect("/rejected");
    }
    redirect("/dashboard");
  }
  
  const nickname = userData?.nickname || "";
  const hasError = params.error === "save_failed";

  return (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '20px'
    }}>
    <div style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "24px",
        padding: "3rem",
        width: "100%",
        maxWidth: "500px",
        color: "white",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
    }}>
        <h1 style={{ 
            fontSize: "1.8rem", 
            fontWeight: "bold", 
            marginBottom: "1rem",
            textAlign: "center",
            background: "linear-gradient(to right, #86efac, #3b82f6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
        }}>承認待ちです</h1>
        
        <p style={{ 
            marginBottom: "1.5rem", 
            lineHeight: 1.6, 
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center"
        }}>
        アカウントは現在、管理者による承認待ちステータスです。<br/>
        承認が完了するまでしばらくお待ちください。
        </p>

        {/* Status message */}
        {nickname && (
        <div style={{ 
            margin: '15px 0', 
            padding: '12px 15px', 
            background: 'rgba(22, 101, 52, 0.2)', 
            borderRadius: '12px', 
            border: '1px solid #166534',
            color: '#86efac',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            <span>✅</span>
            <span>表示名「{nickname}」が設定されました。<br/>管理者の承認をお待ちください。</span>
        </div>
        )}

        {hasError && (
        <div style={{ 
            margin: '15px 0', 
            padding: '12px 15px', 
            background: 'rgba(153, 27, 27, 0.2)', 
            borderRadius: '12px', 
            border: '1px solid #991b1b',
            color: '#fca5a5',
            fontSize: '0.9rem'
        }}>
            ❌ 保存に失敗しました。もう一度お試しください。
        </div>
        )}

        {/* Allow setting nickname while waiting */}
        <div style={{ 
            margin: '25px 0', 
            padding: '20px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '16px', 
            border: '1px solid rgba(255, 255, 255, 0.1)' 
        }}>
            <p style={{fontSize: '0.9rem', marginBottom: '12px', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.9)'}}>
            表示名(ニックネーム)の設定 {!nickname && <span style={{color: '#f87171'}}>※必須</span>}
            </p>
            <form action={updateProfileWithRedirect} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        name="nickname" 
                        defaultValue={nickname}
                        placeholder="例: たなか" 
                        required
                        style={{ 
                            flex: 1, 
                            padding: '10px 14px', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(0, 0, 0, 0.2)',
                            color: 'white',
                            outline: 'none'
                        }}
                    />
                    <button type="submit" style={{ 
                        padding: '10px 20px', 
                        borderRadius: '8px', 
                        background: '#4b5563', 
                        color: 'white', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                    }}>
                        保存
                    </button>
                </div>
            </form>
            {!nickname && (
            <p style={{fontSize: '0.8rem', color: '#9ca3af', marginTop: '10px'}}>
                ※管理者が承認するには、まず表示名を設定してください。
            </p>
            )}
        </div>
        
        {/* Auto-refresh hint */}
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', marginBottom: '20px' }}>
        承認されるとダッシュボードに移動できます。（ページ更新で確認）
        </p>
        
        <form
        action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
        }}
        >
        <button style={{
            width: "100%",
            padding: "12px",
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "12px",
            color: "rgba(255, 255, 255, 0.6)",
            cursor: "pointer",
            transition: "all 0.2s"
        }}>
            ログアウト
        </button>
        </form>
    </div>
    </div>
  );
}
