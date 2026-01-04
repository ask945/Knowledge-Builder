const Topic = require('../models/Topic');

// @desc    Get all topics
// @route   GET /api/topics
const getTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find().sort({ name: 1 });
    res.json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single topic
// @route   GET /api/topics/:id
const getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);

    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    res.json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

// @desc    Create topic
// @route   POST /api/topics
const createTopic = async (req, res, next) => {
  try {
    const { name } = req.body;

    const topic = await Topic.create({ name });

    res.status(201).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

// @desc    Search topics by name
// @route   GET /api/topics/search?q=
const searchTopics = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      const topics = await Topic.find().sort({ name: 1 });
      return res.json({ success: true, data: topics });
    }

    const topics = await Topic.find({
      name: { $regex: q, $options: 'i' },
    }).sort({ name: 1 });

    res.json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete topic
// @route   DELETE /api/topics/:id
const deleteTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.id);

    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTopics,
  getTopic,
  createTopic,
  searchTopics,
  deleteTopic,
};
