import { Queue, Worker, QueueEvents, Job, QueueScheduler } from 'bullmq';
import { whatsappConfig } from './config';
import { Notification, NotificationStatus, NotificationType } from '@/models/Notification';
import { sendTemplateMessage } from './client';
import { logger } from '@/lib/logger';
import { Customer } from '@/models/Customer';

// Queue names
export enum QueueName {
  SEND_NOW = 'waba:send',
  SCHEDULED = 'waba:schedule',
}

// Job names
export enum JobName {
  SEND_TEMPLATE = 'send_template',
  SCHEDULE_REMINDER = 'schedule_reminder',
}

// Connection options
const connection = {
  connection: {
    url: whatsappConfig.UPSTASH_REDIS_URL || 'redis://localhost:6379',
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000, // 3s, 9s, 27s, 81s, 243s
    },
    removeOnComplete: 1000, // Keep last 1000 completed jobs
    removeOnFail: 5000, // Keep last 5000 failed jobs
  },
};

// Initialize queues
export const queues = {
  [QueueName.SEND_NOW]: new Queue(QueueName.SEND_NOW, connection),
  [QueueName.SCHEDULED]: new Queue(QueueName.SCHEDULED, connection),
};

// Initialize queue scheduler for delayed jobs
const scheduler = new QueueScheduler(QueueName.SCHEDULED, connection);

// Initialize queue events for monitoring
const queueEvents = new QueueEvents(QueueName.SEND_NOW, connection);

// Worker for processing send jobs
const sendWorker = new Worker(
  QueueName.SEND_NOW,
  async (job: Job) => {
    const { notificationId } = job.data;
    
    // Get the notification from DB
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Check if notification is already processed
    if (notification.status === NotificationStatus.SENT) {
      logger.info(`Notification ${notificationId} already sent, skipping`);
      return { status: 'skipped', reason: 'already_sent' };
    }

    try {
      // Check customer consent
      const customer = await Customer.findOne({ phoneE164: notification.to });
      if (!customer?.whatsappConsent) {
        throw new Error(`No consent for ${notification.to}`);
      }

      // Send the message
      const result = await sendTemplateMessage({
        to: notification.to,
        templateName: notification.templateName,
        templateLang: notification.templateLang,
        params: notification.templateParams,
      });

      // Update notification status
      notification.status = NotificationStatus.SENT;
      notification.providerMessageId = result.messages[0].id;
      notification.sentAt = new Date();
      notification.attempts += 1;
      await notification.save();

      // Update customer's last notified time
      customer.lastNotifiedAt = new Date();
      await customer.save();

      logger.info(`Notification ${notificationId} sent successfully`, {
        notificationId,
        messageId: result.messages[0].id,
      });

      return { status: 'sent', messageId: result.messages[0].id };
    } catch (error) {
      // Update notification with error
      notification.status = NotificationStatus.FAILED;
      notification.lastError = error.message;
      notification.attempts += 1;
      await notification.save();

      logger.error(`Failed to send notification ${notificationId}`, {
        error: error.message,
        stack: error.stack,
        notificationId,
        attempt: notification.attempts,
      });

      // Re-throw to trigger retry
      throw error;
    }
  },
  {
    ...connection,
    concurrency: 10, // Process 10 messages in parallel
  }
);

// Worker for processing scheduled jobs
const scheduledWorker = new Worker(
  QueueName.SCHEDULED,
  async (job: Job) => {
    const { notificationId } = job.data;
    
    // Move to send queue
    await queues[QueueName.SEND_NOW].add(
      JobName.SEND_TEMPLATE,
      { notificationId },
      { jobId: `send_${notificationId}` }
    );

    return { status: 'queued', notificationId };
  },
  {
    ...connection,
    concurrency: 5,
  }
);

// Log queue events
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info(`Job ${jobId} completed`, { returnvalue });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed`, { error: failedReason });
});

// Helper function to enqueue a notification
export async function enqueueNotification(
  reservaId: string,
  type: NotificationType,
  to: string,
  templateName: string,
  templateParams: string[],
  options: { delay?: number; scheduledFor?: Date } = {}
) {
  // Create notification in DB
  const notification = new Notification({
    reservaId,
    type,
    to,
    templateName,
    templateLang: 'es_AR',
    templateParams,
    status: NotificationStatus.QUEUED,
    scheduledFor: options.scheduledFor,
    idempotencyKey: `${reservaId}:${type}:${templateParams.join(':')}`,
  });
  
  await notification.save();

  // Add to appropriate queue
  const queue = options.delay || options.scheduledFor ? QueueName.SCHEDULED : QueueName.SEND_NOW;
  
  const job = await queues[queue].add(
    queue === QueueName.SCHEDULED ? JobName.SCHEDULE_REMINDER : JobName.SEND_TEMPLATE,
    { notificationId: notification._id },
    {
      jobId: `${queue}:${notification._id}`,
      delay: options.delay,
      ...(options.scheduledFor && { delay: options.scheduledFor.getTime() - Date.now() }),
    }
  );

  logger.info(`Enqueued notification ${notification._id}`, {
    queue,
    jobId: job.id,
    notificationId: notification._id,
    scheduledFor: options.scheduledFor,
  });

  return { notification, job };
}

// Initialize the queue system
export async function initializeQueues() {
  // Start workers
  await Promise.all([
    sendWorker.waitUntilReady(),
    scheduledWorker.waitUntilReady(),
    scheduler.waitUntilReady(),
    queueEvents.waitUntilReady(),
  ]);

  logger.info('Notification queues initialized');
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    sendWorker.close(),
    scheduledWorker.close(),
    scheduler.close(),
    queueEvents.close(),
    ...Object.values(queues).map(q => q.close()),
  ]);
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down queues...');
  await closeQueues();
  process.exit(0);
});
