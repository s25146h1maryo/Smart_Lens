import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { Thread, Task } from "@/types";
import { redirect } from "next/navigation";
import styles from "./thread.module.css";
import Link from "next/link";
import ThreadView from "./ThreadView"; // Import new view
import { getActiveUsers } from "@/app/actions/user";
import { listFiles } from "@/lib/drive";
import { DriveFile } from "@/types";

import { autoArchiveTasks } from "@/app/actions/task";

export default async function ThreadPage({ 
    params 
}: { 
    params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === 'PENDING') redirect("/pending");

  // Auto-Archive before fetch
  await autoArchiveTasks(id);

  const threadDoc = await db.collection("threads").doc(id).get();
  if (!threadDoc.exists) return <div>プロジェクトが見つかりません</div>;
  const thread = threadDoc.data() as Thread;

  // Fetch Tasks
  const taskSnap = await db.collection("tasks")
    .where("threadId", "==", id)
    .get();
  
  const tasks = taskSnap.docs
      .map(d => d.data() as Task)
      .sort((a, b) => b.createdAt - a.createdAt);

  const users = await getActiveUsers();
  
  // Fetch Files safe for server component
  const files: DriveFile[] = thread.driveFolderId 
      ? (await listFiles(thread.driveFolderId)) as DriveFile[] 
      : [];

  // Pass current user role
  const currentUserRole = session.user?.role || "USER";

  return (
      <ThreadView 
         thread={thread} 
         initialTasks={tasks} 
         users={users} 
         currentUserRole={currentUserRole}
         files={files}
      />
  );
}
