import { Router } from 'express';
import { requireFields } from '../middleware/validate';
import { register, login, refresh, logout } from '../controllers/auth.controller';

const router = Router();

router.post('/register', requireFields(['email', 'password']), register);
router.post('/login', requireFields(['email', 'password']), login);
router.post('/refresh', requireFields(['refreshToken']), refresh);
router.post('/logout', requireFields(['refreshToken']), logout);

export default router;
