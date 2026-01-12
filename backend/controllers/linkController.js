const Link = require('../models/Link');
const Note = require('../models/Note');

// @desc    Get all links
// @route   GET /api/links
const getLinks = async (req, res, next) => {
  try {
    const links = await Link.find({ user: req.user._id });
    res.json({ success: true, data: links });
  } catch (error) {
    next(error);
  }
};

// @desc    Create link
// @route   POST /api/links
const createLink = async (req, res, next) => {
  try {
    const { source, target } = req.body;

    // Validate that both notes exist and belong to user
    const sourceNote = await Note.findOne({ _id: source, user: req.user._id });
    const targetNote = await Note.findOne({ _id: target, user: req.user._id });

    if (!sourceNote) {
      return res.status(404).json({ success: false, error: 'Source note not found' });
    }

    if (!targetNote) {
      return res.status(404).json({ success: false, error: 'Target note not found' });
    }

    // Check if link already exists
    const existingLink = await Link.findOne({ source, target, user: req.user._id });
    if (existingLink) {
      return res.status(400).json({ success: false, error: 'Link already exists' });
    }

    const link = await Link.create({ source, target, user: req.user._id });

    res.status(201).json({ success: true, data: link });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete link
// @route   DELETE /api/links/:id
const deleteLink = async (req, res, next) => {
  try {
    const link = await Link.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLinks,
  createLink,
  deleteLink,
};
