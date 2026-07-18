import { Request, Response } from 'express';
import logger from '../utils/logger';
import TroubleshootQuery from '../models/TroubleshootQuery';
import User from '../models/User';

// POST /api/queries — Users (or guests) submit a troubleshooting query
export const submitQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, category, tripId, paymentId, amount, message } = req.body;

    if (!email || !category || !message) {
      res.status(400).json({ message: 'Email, category, and message are required.' });
      return;
    }

    const userId = req.user?.userId;

    const newQuery = new TroubleshootQuery({
      userId,
      email,
      category,
      tripId,
      paymentId,
      amount,
      message,
    });

    await newQuery.save();

    logger.info(`[support-query] Query created by ${email}. Category: ${category}. TripID: ${tripId || 'none'}`);

    res.status(201).json({
      success: true,
      message: 'Your query has been submitted successfully! One of our agents will verify it shortly.',
      query: newQuery,
    });
  } catch (error: any) {
    logger.error('Failed to submit user query', { error });
    res.status(500).json({ message: error.message || 'Failed to submit query.' });
  }
};

// GET /api/queries/my — Users retrieve their own troubleshooting queries
export const getMyQueries = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    let email = '';

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        email = user.email;
      }
    }

    if (!userId && !email) {
      res.status(401).json({ message: 'User context missing.' });
      return;
    }

    const queries = await TroubleshootQuery.find({
      $or: [
        userId ? { userId } : null,
        email ? { email } : null
      ].filter(Boolean) as any[]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      queries,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve user queries', { error });
    res.status(500).json({ message: error.message || 'Failed to retrieve queries.' });
  }
};
