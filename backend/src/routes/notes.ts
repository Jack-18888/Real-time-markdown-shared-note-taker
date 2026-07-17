import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireFields } from '../middleware/validate';
import {
  list,
  create,
  get,
  update,
  remove,
  listShares,
  createShare,
  updateShare,
  removeShare,
} from '../controllers/notes.controller';

const router = Router();

router.use(auth);

router.get('/', list);
router.post('/', requireFields(['title']), create);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

// Sharing sub-routes
router.get('/:id/shares', listShares);
router.post('/:id/shares', requireFields(['email', 'permission']), createShare);
router.patch('/:id/shares/:userId', requireFields(['permission']), updateShare);
router.delete('/:id/shares/:userId', removeShare);

export default router;
