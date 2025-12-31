import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RoomStatusClient from "./RoomStatusClient";

export default async function RoomStatusPage() {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.name) redirect("/login");

    return <RoomStatusClient currentUser={{
        id: session.user.id!,
        name: session.user.name!
    }} />;
}
