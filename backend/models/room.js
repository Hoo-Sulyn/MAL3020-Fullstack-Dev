const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 20,
    },
    type: {
      type: String,
      required: true,
      enum: ['Superior King', 'Garden Suite', 'River View Double'],
    },
    floor: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    amenities: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    nightlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    statusOverride: {
      type: String,
      enum: ['Automatic', 'Available', 'Occupied', 'Maintenance'],
      default: 'Automatic',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
