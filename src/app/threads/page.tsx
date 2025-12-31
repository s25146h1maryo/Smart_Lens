import { getThreads } from "@/app/actions/thread";
import Link from "next/link";
import ThreadListClient from "./ThreadListClient"; // Client wrapper for interactivity if needed, or pure server + separate client interaction?
// Let's keep it simple: Server Page fetches data, passes to Client Component which manages "Create Modal" state?
// Or just a Client Component for the whole page to handle Modal state easily.
// The user wants a robust app.
// Server Component for fetching -> Client Component for List & Modal.

export default async function ThreadsPage() {
    const threads = await getThreads();

    return <ThreadListClient initialThreads={threads} />;
}
