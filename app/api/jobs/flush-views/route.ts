import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

export async function POST(req: NextRequest) {
  // 1. Verify QStash Signature FIRST before any processing
  if (currentSigningKey && nextSigningKey) {
    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
    });

    const signature = req.headers.get('upstash-signature');
    const bodyText = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }

    const isValid = await receiver.verify({
      signature,
      body: bodyText,
    }).catch(() => false);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
    }
  }

  // 2. Scan Redis for pending view counters if live Redis exists
  if (!redis) {
    return NextResponse.json({ message: 'No live Redis connection; skipped flush.' }, { status: 200 });
  }

  try {
    const viewKeys = await redis.keys('note:views:*');
    const dailyKeys = await redis.keys('note:daily_views:*');

    if (viewKeys.length === 0 && dailyKeys.length === 0) {
      return NextResponse.json({ message: 'No pending views to flush.' }, { status: 200 });
    }

    // Process lifetime total view counts
    for (const key of viewKeys) {
      const token = key.replace('note:views:', '');
      const countStr = await redis.get<string | number>(key);
      const count = typeof countStr === 'number' ? countStr : parseInt(countStr || '0', 10);

      if (count > 0) {
        await prisma.$transaction([
          prisma.note.updateMany({
            where: { token },
            data: { viewCount: { increment: count } },
          }),
        ]);
        // Reset counter
        await redis.set(key, 0);
      }
    }

    // Process daily breakdown view counts
    for (const key of dailyKeys) {
      // Key format: note:daily_views:{token}:{YYYY-MM-DD}
      const parts = key.split(':');
      if (parts.length >= 4) {
        const token = parts[2];
        const dateStr = parts[3];
        const countStr = await redis.get<string | number>(key);
        const count = typeof countStr === 'number' ? countStr : parseInt(countStr || '0', 10);

        if (count > 0) {
          const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

          await prisma.noteViewAggregate.upsert({
            where: {
              noteToken_date: {
                noteToken: token,
                date: dateObj,
              },
            },
            update: {
              viewCount: { increment: count },
            },
            create: {
              noteToken: token,
              date: dateObj,
              viewCount: count,
            },
          });

          // Reset counter
          await redis.set(key, 0);
        }
      }
    }

    return NextResponse.json({ success: true, flushedViewKeys: viewKeys.length, flushedDailyKeys: dailyKeys.length });
  } catch (err) {
    console.error('Error flushing views from Redis to Postgres:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
