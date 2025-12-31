import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '100vh',
      width: '100%'
    }}>
      <div style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "24px",
        padding: "3rem",
        width: "100%",
        maxWidth: "400px",
        textAlign: "center",
        color: "white",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
      }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ 
             marginBottom: "0.5rem", 
             fontSize: "1.5rem", 
             fontWeight: "bold",
             background: "linear-gradient(to right, #fff, #a78bfa)",
             WebkitBackgroundClip: "text",
             WebkitTextFillColor: "transparent",
          }}>
            Welcome to SmartLens
          </h1>
          <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.9rem" }}>
            統合型活動支援プラットフォーム
          </p>
        </div>
        
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button type="submit" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            background: "white",
            color: "#374151",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "transform 0.2s",
          }}>
            {/* Google Icon SVG */}
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span>Googleでログイン</span>
          </button>
        </form>
      </div>
    </div>
  );
}
