import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireFields } from '../middleware/validate';
import {
  list,
  create,
  update,
  remove,
} from '../controllers/folders.controller';

const router = Router();

router.use(auth);

router.get('/', list);
router.post('/', requireFields(['name']), create);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
