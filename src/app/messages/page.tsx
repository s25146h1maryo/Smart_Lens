import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActiveUsers } from "@/app/actions/user";
import { getUserChats } from "@/app/actions/chat";
import MessagesLayout from "./MessagesLayout";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; chatId?: string; thread?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === 'PENDING') redirect("/pending");

  const params = await searchParams;
  
  // V12: Handle Thread Quick Access (Find or Create Linked Group)
  if (params.thread) {
      const { createGroupForThread } = await import("@/app/actions/chat");
      const { db } = await import("@/lib/firebase");
      
      // 1. Check if chat exists
      const existingQuery = await db.collection("chats").where("threadId", "==", params.thread).limit(1).get();
      if (!existingQuery.empty) {
          redirect(`/messages?chatId=${existingQuery.docs[0].id}`);
      }

      // 2. If not, fetch thread to create one
      const threadDoc = await db.collection("threads").doc(params.thread).get();
      if (threadDoc.exists) {
          const threadData = threadDoc.data();
          if (threadData) {
              const res = await createGroupForThread(params.thread, threadData.title, threadData.members);
              if (res.success && res.chatId) {
                  redirect(`/messages?chatId=${res.chatId}`);
              }
          }
      }
      // If thread not found or creation failed, fallback to main
      redirect("/messages");
  }

  const users = await getActiveUsers();
  const chats = await getUserChats(); // All my chats
  
  let chatId = params.chatId || "";
  const selectedUserId = params.uid || "";

  let selectedUser = null;
  let chatName = "";
  let isGroup = false;
  let initialMessages: any[] = [];
  let participants: string[] = [];
  let threadId: string | undefined;

  // Logic to determine context
  if (selectedUserId) {
       // Prevent self-selection manually via URL
       if (selectedUserId === session.user.id) {
           redirect("/messages");
       }

       // DM Context selected via User List
       selectedUser = users.find(u => u.id === selectedUserId);
       if (selectedUser) {
           chatId = [session.user.id, selectedUserId].sort().join("_");
       }
  } else if (chatId) {
       // Group or DM Context selected via Chat List
       const chat = chats.find(c => c.id === chatId);
       if (chat) {
           participants = chat.participants; // Get participants from chat doc
           if (chat.type === 'group') {
               isGroup = true;
               chatName = chat.name || "Group Chat";
               threadId = chat.threadId; // Extract threadId
           } else {
               // It's a DM, find the other user
               const otherId = chat.participants.find(p => p !== session.user.id);
               if (otherId) selectedUser = users.find(u => u.id === otherId);
           }
       }
  }

  // Fetch messages is now handled by RTDB on Client.
  if (chatId) {
      initialMessages = []; 
  }

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden"> 
          <MessagesLayout 
             users={users} 
             currentUser={session.user} 
             chats={chats} 
             selectedUserId={selectedUserId}
             selectedUser={selectedUser}
             chatId={chatId}
             initialMessages={initialMessages}
             chatName={chatName}
             isGroup={isGroup}
             participants={participants}
             threadId={threadId}
          />
    </div>
  );
}
