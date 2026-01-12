const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      required: [true, 'Source note is required'],
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      required: [true, 'Target note is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Link', linkSchema);
