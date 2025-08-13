import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  phoneE164: string; // Primary key in E.164 format
  nombre?: string;
  email?: string;
  whatsappConsent: boolean;
  whatsappOptOutAt?: Date;
  lastNotifiedAt?: Date;
  notificationPreferences: {
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    phoneE164: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: (v: string) => {
          // Basic E.164 format validation
          return /^\+[1-9]\d{1,14}$/.test(v);
        },
        message: (props: any) => `${props.value} is not a valid E.164 phone number!`,
      },
    },
    nombre: { type: String },
    email: { 
      type: String,
      validate: {
        validator: (v: string) => {
          // Simple email validation
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props: any) => `${props.value} is not a valid email address!`,
      },
    },
    whatsappConsent: { 
      type: Boolean, 
      default: true, // Default to true, users must explicitly opt-out
      index: true,
    },
    whatsappOptOutAt: { type: Date },
    lastNotifiedAt: { type: Date },
    notificationPreferences: {
      whatsapp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Index for faster lookups
CustomerSchema.index({ whatsappConsent: 1, lastNotifiedAt: 1 });
CustomerSchema.index({ email: 1 }, { unique: true, sparse: true });

// Helper method to update consent
CustomerSchema.methods.updateConsent = async function(consent: boolean) {
  this.whatsappConsent = consent;
  this.whatsappOptOutAt = consent ? undefined : new Date();
  return this.save();
};

// Static method to find or create a customer
export async function findOrCreateCustomer(phoneE164: string, data: Partial<ICustomer> = {}) {
  let customer = await Customer.findOne({ phoneE164 });
  
  if (!customer) {
    customer = new Customer({
      phoneE164,
      ...data,
    });
    await customer.save();
  }
  
  return customer;
}

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
