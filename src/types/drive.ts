export interface DriveItem {
    id: string;
    name: string;
    type: 'folder' | 'file';
    mimeType?: string; // e.g. 'image/png', 'application/pdf'
    size: number;
    parentId: string | null; // null for Root
    ownerId: string;
    path: string[]; // Ancestor IDs for breadcrumbs
    createdAt: number;
    updatedAt: number;
    gcsPath?: string; // Google Drive ID
    webViewLink?: string; // Public/Authenticated URL
    isTrashed: boolean;
    isShared?: boolean; // true if item is in shared drive
}

export interface Breadcrumb {
    id: string;
    name: string;
}
