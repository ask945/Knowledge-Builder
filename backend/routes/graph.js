const express = require('express');
const router = express.Router();
const { getGraph, getGraphByTopic, getGraphTopics, summarizeWithAI, listAvailableModels } = require('../controllers/graphController');

router.get('/', getGraph);
router.get('/topics', getGraphTopics);
router.get('/models', listAvailableModels);
router.post('/summarize', summarizeWithAI);
router.get('/:topicId', getGraphByTopic);

module.exports = router;
