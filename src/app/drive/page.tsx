import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDriveItems, getBreadcrumbs, getSharedDriveItems, getSharedDriveBreadcrumbs } from "@/app/actions/drive";
import { DriveLayout } from "./components";
import DriveClientWrapper from "./DriveClientWrapper"; 

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string, mode?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const folderId = params.folderId || null;
  const mode = params.mode || 'private';
  const isShared = mode === 'shared';

  let items, breadcrumbs;

  if (isShared) {
      try {
          items = await getSharedDriveItems(folderId || null);
          breadcrumbs = await getSharedDriveBreadcrumbs(folderId || null);
      } catch (e) {
          console.error("Shared Drive Error:", e);
          items = [];
          breadcrumbs = [{ id: 'error', name: 'Error' }];
      }
  } else {
      items = await getDriveItems(folderId || null);
      breadcrumbs = await getBreadcrumbs(folderId || null);
  }

  return (
    <DriveLayout user={session?.user}>
        <DriveClientWrapper 
            initialItems={items} 
            breadcrumbs={breadcrumbs} 
            folderId={folderId || ""} 
            isShared={isShared}
        />
    </DriveLayout>
  );
}
