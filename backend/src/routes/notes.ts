import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireFields } from '../middleware/validate';
import {
  list,
  create,
  get,
  update,
  remove,
} from '../controllers/notes.controller';

const router = Router();

router.use(auth);

router.get('/', list);
router.post('/', requireFields(['title']), create);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
