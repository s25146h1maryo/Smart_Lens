import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  // @ts-ignore - Role is added by Node auth, verified by Edge auth via token decryption
  const userRole = req.auth?.user?.role;
  const userId = req.auth?.user?.id;
  
  // 🚨 SECURITY: Check if user was deleted (session invalidated)
  const isSessionInvalid = isLoggedIn && (!userId || !userRole);
  
  const isPending = userRole === "PENDING";
  const isRejected = userRole === "REJECTED";
  
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isOnThread = req.nextUrl.pathname.startsWith("/thread");
  const isOnProfile = req.nextUrl.pathname.startsWith("/profile");
  const isOnMessages = req.nextUrl.pathname.startsWith("/messages");
  const isOnDrive = req.nextUrl.pathname.startsWith("/drive");
  const isOnAttendance = req.nextUrl.pathname.startsWith("/attendance");
  const isOnCalendar = req.nextUrl.pathname.startsWith("/calendar");
  const isOnSettings = req.nextUrl.pathname.startsWith("/settings");
  const isOnPending = req.nextUrl.pathname === "/pending";
  const isOnRejected = req.nextUrl.pathname === "/rejected";
  const isOnLogin = req.nextUrl.pathname === "/login";

  const isProtectedRoute = isOnDashboard || isOnAdmin || isOnThread || isOnProfile || 
                           isOnMessages || isOnDrive || isOnAttendance || isOnCalendar || 
                           isOnSettings || isOnPending || isOnRejected;

  // 1. Not Logged In or Invalid Session Protection
  if (!isLoggedIn || isSessionInvalid) {
     if (isProtectedRoute) {
        return NextResponse.redirect(new URL("/login", req.url));
     }
     return NextResponse.next();
  }

  // 2. Rejected Isolation - REJECTED users can only see the rejected page
  if (isRejected) {
    if (!isOnRejected) {
         return NextResponse.redirect(new URL("/rejected", req.url));
    }
    return NextResponse.next();
  }

  // 3. Pending Isolation
  if (isPending) {
    if (!isOnPending) {
         return NextResponse.redirect(new URL("/pending", req.url));
    }
    return NextResponse.next();
  }

  // 4. Active User on /pending or /rejected
  if (!isPending && isOnPending) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (!isRejected && isOnRejected) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  
  // 5. Login page when already logged in
  if (isOnLogin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|google.*\\.html).*)"],
};
