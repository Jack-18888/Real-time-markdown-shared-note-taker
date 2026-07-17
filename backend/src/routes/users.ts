import { Router } from 'express';
import { auth } from '../middleware/auth';
import { me, search } from '../controllers/users.controller';

const router = Router();

router.use(auth);

router.get('/me', me);
router.get('/search', search);

export default router;
