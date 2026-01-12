const Note = require('../models/Note');
const Link = require('../models/Link');

// @desc    Get all notes
// @route   GET /api/notes
const getNotes = async (req, res, next) => {
  try {
    const notes = await Note.find({ user: req.user._id })
      .populate('topics', 'name')
      .populate('prerequisites', 'title')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
const getNote = async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id })
      .populate('topics', 'name')
      .populate('prerequisites', 'title');

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Create note
// @route   POST /api/notes
const createNote = async (req, res, next) => {
  try {
    const { title, blocks, topics, prerequisites } = req.body;

    // Validate prerequisites: filter out any invalid IDs and ensure they belong to the user
    const validPrerequisites = (prerequisites || []).filter(prereqId => {
      return prereqId && prereqId.toString().match(/^[0-9a-fA-F]{24}$/);
    });

    // Verify all prerequisites belong to the user
    if (validPrerequisites.length > 0) {
      const prereqCount = await Note.countDocuments({
        _id: { $in: validPrerequisites },
        user: req.user._id,
      });
      if (prereqCount !== validPrerequisites.length) {
        return res.status(400).json({ success: false, error: 'Some prerequisites do not belong to you' });
      }
    }

    // Verify all topics belong to the user
    if (topics && topics.length > 0) {
      const Topic = require('../models/Topic');
      const topicCount = await Topic.countDocuments({
        _id: { $in: topics },
        user: req.user._id,
      });
      if (topicCount !== topics.length) {
        return res.status(400).json({ success: false, error: 'Some topics do not belong to you' });
      }
    }

    const note = await Note.create({
      title,
      blocks: blocks || [{ type: 'text', value: '' }],
      topics: topics || [],
      prerequisites: validPrerequisites,
      user: req.user._id,
    });

    const populatedNote = await Note.findById(note._id)
      .populate('topics', 'name')
      .populate('prerequisites', 'title');

    res.status(201).json({ success: true, data: populatedNote });
  } catch (error) {
    next(error);
  }
};

// @desc    Update note
// @route   PUT /api/notes/:id
const updateNote = async (req, res, next) => {
  try {
    const { title, blocks, topics, prerequisites } = req.body;
    const noteId = req.params.id;

    // Check if note exists and belongs to user
    const existingNote = await Note.findOne({ _id: noteId, user: req.user._id });
    if (!existingNote) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Validate prerequisites: filter out self-reference and invalid IDs
    const validPrerequisites = (prerequisites || []).filter(prereqId => {
      const prereqIdStr = prereqId.toString();
      const noteIdStr = noteId.toString();
      // Remove self-reference
      if (prereqIdStr === noteIdStr) {
        return false;
      }
      // Validate ObjectId format
      return prereqIdStr.match(/^[0-9a-fA-F]{24}$/);
    });

    // Remove duplicates
    const uniquePrerequisites = [...new Set(validPrerequisites)];

    // Verify all prerequisites belong to the user
    if (uniquePrerequisites.length > 0) {
      const prereqCount = await Note.countDocuments({
        _id: { $in: uniquePrerequisites },
        user: req.user._id,
      });
      if (prereqCount !== uniquePrerequisites.length) {
        return res.status(400).json({ success: false, error: 'Some prerequisites do not belong to you' });
      }
    }

    // Verify all topics belong to the user
    if (topics && topics.length > 0) {
      const Topic = require('../models/Topic');
      const topicCount = await Topic.countDocuments({
        _id: { $in: topics },
        user: req.user._id,
      });
      if (topicCount !== topics.length) {
        return res.status(400).json({ success: false, error: 'Some topics do not belong to you' });
      }
    }

    const note = await Note.findByIdAndUpdate(
      noteId,
      { title, blocks, topics, prerequisites: uniquePrerequisites },
      { new: true, runValidators: true }
    )
      .populate('topics', 'name')
      .populate('prerequisites', 'title');

    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete note and its links
// @route   DELETE /api/notes/:id
const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the note before deleting to access its prerequisites
    const note = await Note.findOne({ _id: id, user: req.user._id });

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Get the deleted note's prerequisites (as ObjectIds)
    const deletedNotePrerequisites = (note.prerequisites || []).map(p => p.toString());

    // Find all notes that have this note as a prerequisite (only user's notes)
    const dependentNotes = await Note.find({ prerequisites: id, user: req.user._id });

    // Update each dependent note: replace the deleted note with its prerequisites
    for (const dependentNote of dependentNotes) {
      // Remove the deleted note from prerequisites
      const updatedPrerequisites = dependentNote.prerequisites
        .map(p => p.toString())
        .filter(prereqId => prereqId !== id);

      // Add the deleted note's prerequisites (avoid duplicates)
      deletedNotePrerequisites.forEach(prereqId => {
        if (!updatedPrerequisites.includes(prereqId)) {
          updatedPrerequisites.push(prereqId);
        }
      });

      // Update the note with new prerequisites
      await Note.findByIdAndUpdate(dependentNote._id, {
        prerequisites: updatedPrerequisites,
      });
    }

    // Delete the note
    await Note.findByIdAndDelete(id);

    // Cascade delete: remove all links where this note is source OR target (only user's links)
    await Link.deleteMany({
      $or: [{ source: id }, { target: id }],
      user: req.user._id,
    });

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Search notes by title
// @route   GET /api/notes/search?q=
const searchNotes = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const notes = await Note.find({
      title: { $regex: q, $options: 'i' },
      user: req.user._id,
    }).sort({ updatedAt: -1 });

    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get links for a specific note
// @route   GET /api/notes/:id/links
const getNoteLinks = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify note belongs to user
    const note = await Note.findOne({ _id: id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    const links = await Link.find({
      $or: [{ source: id }, { target: id }],
      user: req.user._id,
    });

    res.json({ success: true, data: links });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  getNoteLinks,
};
