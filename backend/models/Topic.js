const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a topic name'],
      trim: true,
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

// Compound index to ensure unique topic names per user
topicSchema.index({ name: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Topic', topicSchema);
