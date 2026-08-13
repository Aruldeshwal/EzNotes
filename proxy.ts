import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { checkRateLimit } from './lib/rate-limit';

const isProtectedRoute = createRouteMatcher(['/notes(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
  const pathname = req.nextUrl.pathname;

  // Edge Rate Limiting per CodeStandards.md
  if (pathname.startsWith('/share/')) {
    const { success } = await checkRateLimit('publicShareLoad', ip, 5, 60000);
    if (!success) {
      return new NextResponse('Too Many Requests: Public share rate limit exceeded.', { status: 429 });
    }
  } else if (pathname.includes('/content')) {
    const { success } = await checkRateLimit('collaborativePatches', ip, 5, 60000);
    if (!success) {
      return new NextResponse('Too Many Requests: Patch rate limit exceeded.', { status: 429 });
    }
  } else if (pathname.startsWith('/api/')) {
    const { success } = await checkRateLimit('globalApi', ip, 100, 60000);
    if (!success) {
      return new NextResponse('Too Many Requests: Global API rate limit exceeded.', { status: 429 });
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
