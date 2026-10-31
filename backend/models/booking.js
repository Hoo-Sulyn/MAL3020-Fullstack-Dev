const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true },
    guestPhone: { type: String, required: true },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    roomNumber: { type: String, required: true },
    roomType: { type: String, required: true },
    checkIn: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    checkOut: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    adults: { type: Number, required: true, min: 1, validate: Number.isInteger },
    children: { type: Number, required: true, min: 0, validate: Number.isInteger },
    travelingWithPets: { type: Boolean, default: false, required: true },
    nightlyRate: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['Confirmed', 'Checked in', 'Checked out', 'Cancelled'],
      default: 'Confirmed',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
