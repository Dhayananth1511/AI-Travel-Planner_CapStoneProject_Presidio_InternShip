import { Request, Response } from 'express';
import * as adminService from '../services/adminService';

// GET /api/admin/trips — View ALL trips across all users (admin only)
export const getAllTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, destination, page = 1, limit = 20 } = req.query;
    const result = await adminService.getPaginatedTrips(
      status,
      destination,
      Number(page),
      Number(limit)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch trips' });
  }
};

// GET /api/admin/analytics — Dashboard stats for charts
export const getAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await adminService.getAnalyticsDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Analytics failed' });
  }
};

// GET /api/admin/logs — Retrieve application logs (admin only)
export const getSystemLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 200;
    const logs = await adminService.readSystemLogs(limit);
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve system logs', error: error.message });
  }
};

// GET /api/admin/queries — Get all troubleshoot tickets (admin only)
export const getQueries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const queries = await adminService.getTroubleshootQueries(status as string);
    res.json({ success: true, queries });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch troubleshoot queries', error: error.message });
  }
};

// POST /api/admin/queries/:queryId/resolve — Mark troubleshoot ticket as resolved (admin only)
export const resolveQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queryId } = req.params;
    const { adminReply } = req.body;
    const resolved = await adminService.resolveTroubleshootQuery(queryId as string, adminReply as string);
    if (!resolved) {
      res.status(404).json({ message: 'Query not found' });
      return;
    }
    res.json({ success: true, message: 'Query marked as resolved', query: resolved });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to resolve query', error: error.message });
  }
};

// GET /api/admin/trips/:tripId — View single trip details (admin only)
export const getSingleTripForAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const trip = await adminService.adminGetTripById(tripId as string);
    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }
    res.json({ trip });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve trip details', error: error.message });
  }
};
