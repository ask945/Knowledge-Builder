const express = require('express');
const router = express.Router();
const {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  getNoteLinks,
} = require('../controllers/noteController');

// Search must come before :id route to avoid conflict
router.get('/search', searchNotes);

router.route('/').get(getNotes).post(createNote);

router.route('/:id').get(getNote).put(updateNote).delete(deleteNote);

router.get('/:id/links', getNoteLinks);

module.exports = router;
