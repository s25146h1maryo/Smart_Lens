import { NextResponse } from 'next/server';

// Force static generation to ensure this route is pre-rendered
export const dynamic = 'force-static';

export async function GET() {
  // Return the exact content Google expects
  return new NextResponse('google-site-verification: google9521b8956bb3057c.html', {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
