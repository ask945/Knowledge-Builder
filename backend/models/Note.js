const mongoose = require('mongoose');

const contentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },
    value: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    blocks: {
      type: [contentBlockSchema],
      default: [{ type: 'text', value: '' }],
    },
    topics: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
      default: [],
    },
    prerequisites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Note', noteSchema);
