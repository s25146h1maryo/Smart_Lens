import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { redirect } from "next/navigation";
import CreateThreadModal from "./CreateThreadModal";
import { getDashboardData } from "@/app/actions/dashboard";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === 'PENDING') redirect("/pending");
  
  const params = await searchParams;
  const showCreateModal = params.create === "true";

  // Fetch dashboard data and auxiliary data
  const [data, threadsSnap, usersSnap] = await Promise.all([
    getDashboardData(),
    db.collection("threads").where("status", "==", "active").get(),
    db.collection("users").where("role", "!=", "PENDING").get()
  ]);

  const threads = threadsSnap.docs.map(doc => ({ 
    id: doc.id, 
    title: doc.data().title 
  }));

  const users = usersSnap.docs.map(doc => ({
    id: doc.id,
    uid: doc.id,
    name: doc.data().nickname || doc.data().displayName || doc.data().name || 'Unknown',
    nickname: doc.data().nickname,
    email: doc.data().email
  }));

  const currentUser = {
    id: session.user.id,
    name: session.user.name || 'User',
    email: session.user.email || ''
  };

  return (
    <>
      <DashboardClient 
        stats={data.stats}
        highPriorityTasks={data.highPriorityTasks}
        myTasks={data.myTasks}
        recentThreads={data.recentThreads}
        todayAttendees={data.todayAttendees}
        currentUser={currentUser}
        threads={threads}
        users={users}
        overallCompletion={data.overallCompletion}
        myCompletion={data.myCompletion}
        allTasks={data.allTasks}
      />
      {showCreateModal && <CreateThreadModal />}
    </>
  );
}
