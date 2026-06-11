import { NextResponse } from 'next/server';
import RewardService from '@/services/RewardService';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const queryBulan = url.searchParams.get('bulan');
    const selectedBulan = queryBulan ? parseInt(queryBulan) : null;

    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const leaderboard = await RewardService.getLeaderboard(yearNum, selectedBulan);

    return NextResponse.json(leaderboard);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
