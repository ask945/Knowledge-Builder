const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a topic name'],
      trim: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Topic', topicSchema);
