import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createOrUpdateTrip, approveTrip, rejectTrip,
  getUserTrips, getTripById, cancelTrip, deleteTrip, selectHotel,
  getPlacePhoto, selectTransport, syncCalendar,
  createRazorpayOrder, verifyAndApproveTrip
} from '../controllers/tripController';

const router = Router();

// Guard 1: Must be authenticated
// Guard 2: Must be a Traveler (not Admin) — per the brief, only Travelers
//          can create, view, and manage their own trip plans.
router.use(authenticate);

router.post('/plan', createOrUpdateTrip);
router.get('/', getUserTrips);
router.get('/place-photo', getPlacePhoto);
router.get('/:tripId', getTripById);
router.post('/:tripId/approve', approveTrip);
router.post('/:tripId/reject', rejectTrip);
router.post('/:tripId/select-hotel', selectHotel);
router.post('/:tripId/select-transport', selectTransport);
router.post('/:tripId/sync-calendar', syncCalendar);
router.post('/:tripId/cancel', cancelTrip);
router.delete('/:tripId', deleteTrip);

// Razorpay MCP — payment gateway routes
router.post('/:tripId/razorpay-order', createRazorpayOrder);
router.post('/:tripId/verify-payment', verifyAndApproveTrip);

export default router;

