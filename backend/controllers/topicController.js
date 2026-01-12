const Topic = require('../models/Topic');

// @desc    Get all topics
// @route   GET /api/topics
const getTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find({ user: req.user._id }).sort({ name: 1 });
    res.json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single topic
// @route   GET /api/topics/:id
const getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, user: req.user._id });

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

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Topic name is required' });
    }

    // Check if topic with this name already exists for this user
    const existingTopic = await Topic.findOne({ 
      name: name.trim(), 
      user: req.user._id 
    });

    if (existingTopic) {
      // Return existing topic instead of creating a duplicate
      return res.status(200).json({ success: true, data: existingTopic });
    }

    // Create new topic if it doesn't exist
    const topic = await Topic.create({ name: name.trim(), user: req.user._id });

    res.status(201).json({ success: true, data: topic });
  } catch (error) {
    // Handle duplicate key error as a fallback (in case of race condition)
    if (error.code === 11000) {
      // Try to find and return the existing topic
      const existingTopic = await Topic.findOne({ 
        name: req.body.name?.trim(), 
        user: req.user._id 
      });
      if (existingTopic) {
        return res.status(200).json({ success: true, data: existingTopic });
      }
    }
    next(error);
  }
};

// @desc    Search topics by name
// @route   GET /api/topics/search?q=
const searchTopics = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      const topics = await Topic.find({ user: req.user._id }).sort({ name: 1 });
      return res.json({ success: true, data: topics });
    }

    const topics = await Topic.find({
      name: { $regex: q, $options: 'i' },
      user: req.user._id,
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
    const topic = await Topic.findOneAndDelete({ _id: req.params.id, user: req.user._id });

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
