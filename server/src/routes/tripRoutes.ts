import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createOrUpdateTrip, approveTrip, rejectTrip,
  getUserTrips, getTripById, cancelTrip
} from '../controllers/tripController';

const router = Router();

// All trip routes require the user to be authenticated
router.use(authenticate);

router.post('/plan', createOrUpdateTrip);
router.get('/', getUserTrips);
router.get('/:tripId', getTripById);
router.post('/:tripId/approve', approveTrip);
router.post('/:tripId/reject', rejectTrip);
router.delete('/:tripId', cancelTrip);

export default router;
