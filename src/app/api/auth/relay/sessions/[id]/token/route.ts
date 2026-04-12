import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { consumeRelayToken, getRelaySession } from '@/lib/relay-store';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getRelaySession(id);

  if (!session) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (session.status === 'error') {
    return NextResponse.json(
      {
        error: 'login_failed',
        message: session.errorMessage || 'ArcGIS login could not be completed.',
      },
      { status: 410 }
    );
  }

  if (session.expiresAt < Date.now()) {
    return NextResponse.json({ error: 'session_expired' }, { status: 410 });
  }

  if (session.status === 'pending') {
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }

  const token = consumeRelayToken(id);

  if (!token) {
    return NextResponse.json({ error: 'session_expired' }, { status: 410 });
  }

  return NextResponse.json(token);
}