const express = require('express');
const router = express.Router();
const {
  getTopics,
  getTopic,
  createTopic,
  searchTopics,
  deleteTopic,
} = require('../controllers/topicController');

router.get('/search', searchTopics);

router.route('/').get(getTopics).post(createTopic);

router.route('/:id').get(getTopic).delete(deleteTopic);

module.exports = router;
