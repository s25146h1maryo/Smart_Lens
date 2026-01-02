
import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('google-site-verification: google9521b8956bb3057c.html', {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
