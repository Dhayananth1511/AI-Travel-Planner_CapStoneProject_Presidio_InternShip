import mongoose, { Document, Schema } from 'mongoose';

export interface ITroubleshootQuery extends Document {
  userId?: mongoose.Types.ObjectId;
  email: string;
  category: 'PAYMENT' | 'BOOKING' | 'CALENDAR' | 'OTHER';
  tripId?: string;
  paymentId?: string;
  amount?: number;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  adminReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TroubleshootQuerySchema = new Schema<ITroubleshootQuery>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: false },
    email: { type: String, required: true, trim: true, lowercase: true },
    category: {
      type: String,
      enum: ['PAYMENT', 'BOOKING', 'CALENDAR', 'OTHER'],
      required: true,
      index: true
    },
    tripId: { type: String, trim: true, index: true, required: false },
    paymentId: { type: String, trim: true, required: false },
    amount: { type: Number, required: false },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED'],
      default: 'PENDING',
      index: true
    },
    adminReply: { type: String, trim: true, required: false }
  },
  { timestamps: true }
);

export default mongoose.model<ITroubleshootQuery>('TroubleshootQuery', TroubleshootQuerySchema);
