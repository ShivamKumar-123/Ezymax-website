import { NextResponse } from 'next/server';
import { getMarketNews } from '@/lib/marketNews';
import { CRM_URL } from '@/lib/crm';

/**
 * GET /api/market-news: the homepage news ticker's refresh. Server-side only access to the platform's news service
 * (NEWS_URL, NEWS_INTERNAL_TOKEN); the response is the sanitised list, cached for 60 seconds.
 */
export const revalidate = 60;

export async function GET() {
  const data = await getMarketNews(`${CRM_URL}/calendar`);
  return NextResponse.json(data, {
    headers: { 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' },
  });
}
