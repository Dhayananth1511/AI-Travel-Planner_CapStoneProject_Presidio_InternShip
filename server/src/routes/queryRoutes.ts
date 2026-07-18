import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { submitQuery, getMyQueries } from '../controllers/queryController';

const router = Router();

// Retrieve own support tickets (requires authentication)
router.get('/my', authenticate, getMyQueries);

// Submit query (accepts guest entries, reads user details if signed in)
router.post('/', optionalAuthenticate, submitQuery);

export default router;
