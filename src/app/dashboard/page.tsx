import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <>
        <DashboardClient />
    </>
  );
}
