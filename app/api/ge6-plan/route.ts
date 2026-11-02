import { NextResponse } from 'next/server';
import { ge6CurrentRanking } from '@/lib/ge6-current';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const ranking = await ge6CurrentRanking('votes');
    return NextResponse.json({
      updatedAt: ranking.voteSyncedAt,
      votedTotal: ranking.votedTotal,
      trackedTotal: ranking.trackedTotal,
      untrackedTotal: ranking.untrackedTotal,
      rows: ranking.rows.map((row:{name:string;amount:string}) => ({ name: row.name, amount: row.amount })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'โหลดคะแนนคาดการณ์ไม่สำเร็จ' }, { status: 503 });
  }
}
