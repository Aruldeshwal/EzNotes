import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/db';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error('Missing CLERK_WEBHOOK_SECRET environment variable.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Get Svix headers for verification
  const svix_id = req.headers.get('svix-id');
  const svix_timestamp = req.headers.get('svix-timestamp');
  const svix_signature = req.headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix verification headers' }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(webhookSecret);
  let evt: { type: string; data: { id?: string } };

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as { type: string; data: { id?: string } };
  } catch (err) {
    console.error('Error verifying Clerk webhook signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Primary cleanup path for user.deleted event per architecture.md §5.7
  if (evt.type === 'user.deleted' && evt.data?.id) {
    const userId = evt.data.id;
    try {
      await prisma.$transaction([
        prisma.note.deleteMany({ where: { clerkUserId: userId } }),
        prisma.userSettings.deleteMany({ where: { clerkUserId: userId } }),
      ]);
      console.log(`Successfully purged notes and settings for deleted user: ${userId}`);
    } catch (err) {
      console.error(`Failed to purge data for deleted user ${userId}:`, err);
      return NextResponse.json({ error: 'Failed to purge user data' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
