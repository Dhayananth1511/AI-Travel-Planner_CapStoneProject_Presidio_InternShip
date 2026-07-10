import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { getAllTrips, getAnalytics } from '../controllers/adminController';

const router = Router();

// Both middlewares run: first verify JWT, then verify admin role
router.use(authenticate, authorizeAdmin);

router.get('/trips', getAllTrips);
router.get('/analytics', getAnalytics);

export default router;
