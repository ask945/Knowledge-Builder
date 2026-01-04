const express = require('express');
const router = express.Router();
const { getGraph, getGraphByTopic, getGraphTopics } = require('../controllers/graphController');

router.get('/', getGraph);
router.get('/topics', getGraphTopics);
router.get('/:topicId', getGraphByTopic);

module.exports = router;
