export interface Message {
    id: string;
    senderId: string;
    content: string;
    createdAt: number;
    reactions?: Record<string, string>; // userId -> emoji
    replyTo?: {
        id: string;
        content: string;
        senderId: string;
    };
    attachments?: any[];
}

export interface Chat {
    id: string;
    type?: 'dm' | 'group';
    name?: string;
    participants: string[];
    lastMessage: string;
    updatedAt: number;
    seenBy: string[];
    threadId?: string;
}
