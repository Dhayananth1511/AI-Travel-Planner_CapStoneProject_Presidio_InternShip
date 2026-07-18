import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import {
  getAllTrips,
  getAnalytics,
  getSystemLogs,
  getQueries,
  resolveQuery,
  getSingleTripForAdmin
} from '../controllers/adminController';

const router = Router();

// Both middlewares run: first verify JWT, then verify admin role
router.use(authenticate, authorizeAdmin);

router.get('/trips', getAllTrips);
router.get('/trips/:tripId', getSingleTripForAdmin);
router.get('/analytics', getAnalytics);
router.get('/logs', getSystemLogs);
router.get('/queries', getQueries);
router.post('/queries/:queryId/resolve', resolveQuery);

export default router;
