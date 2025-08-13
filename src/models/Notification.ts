import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  REMINDER_24H = 'REMINDER_24H',
  REMINDER_2H = 'REMINDER_2H',
  CANCELLED = 'CANCELLED',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface INotification extends Document {
  reservaId: string;
  type: NotificationType;
  to: string; // E.164 format
  templateName: string;
  templateLang: string;
  templateParams: string[];
  status: NotificationStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  idempotencyKey: string;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    reservaId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    to: { type: String, required: true, index: true },
    templateName: { type: String, required: true },
    templateLang: { type: String, default: 'es_AR' },
    templateParams: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.QUEUED,
    },
    providerMessageId: { type: String, index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    scheduledFor: { type: Date, index: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Index for faster lookups
NotificationSchema.index({ status: 1, scheduledFor: 1 });
NotificationSchema.index({ reservaId: 1, type: 1 }, { unique: false });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
