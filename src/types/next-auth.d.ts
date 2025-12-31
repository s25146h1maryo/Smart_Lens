import "next-auth";
import { UserRole } from "./types";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name?: string;
            image?: string;
            role: UserRole;
            jobTitle: string;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: UserRole;
        jobTitle: string;
    }
}
