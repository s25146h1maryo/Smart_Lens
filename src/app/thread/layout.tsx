import { getThreads } from "@/app/actions/thread";
import ThreadNavigation from "./ThreadNavigation";

export default async function ThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const threads = await getThreads();

  return (
    <div className="flex h-screen overflow-hidden"> 
      <ThreadNavigation threads={threads} />
      
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
