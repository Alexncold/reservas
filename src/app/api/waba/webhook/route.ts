import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, processWebhookEvent } from '@/lib/whatsapp/client';
import { logger } from '@/lib/logger';

// Handle GET request for webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  logger.info('Received webhook verification request', { mode, hasToken: !!token });

  if (!mode || !token || !challenge) {
    logger.warn('Missing required parameters for webhook verification');
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  const { verified, challenge: responseChallenge } = verifyWebhook(
    mode,
    token,
    challenge
  );

  if (!verified) {
    logger.warn('Webhook verification failed', { mode, token });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 }
    );
  }

  logger.info('Webhook verified successfully');
  return new NextResponse(responseChallenge, { status: 200 });
}

// Handle POST request for webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    logger.info('Received webhook event', { event: body });

    // Process the webhook event asynchronously
    processWebhookEvent(body).catch(error => {
      logger.error('Error processing webhook event asynchronously', {
        error: error.message,
        stack: error.stack,
      });
    });

    // Always return 200 OK to acknowledge receipt
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    logger.error('Error processing webhook request', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

// Ensure we only accept GET and POST methods
export const dynamic = 'force-dynamic';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
