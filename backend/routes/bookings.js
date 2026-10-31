const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const Room = require('../models/room');
const User = require('../models/user');
const requireAuth = require('../middleware/require-auth');
const { getHotelDateValue } = require('../utils/date');

const router = express.Router();
const activeStatuses = ['Confirmed', 'Checked in'];
const bookingQueues = new Map();

async function withRoomBookingLock(roomId, operation) {
  const previous = bookingQueues.get(roomId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  bookingQueues.set(roomId, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (bookingQueues.get(roomId) === current) {
      bookingQueues.delete(roomId);
    }
  }
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function bookingData(booking) {
  const value = typeof booking.toObject === 'function' ? booking.toObject() : booking;
  return {
    id: value._id.toString(),
    bookingId: `HV-${value._id.toString().slice(-6).toUpperCase()}`,
    guestId: value.guestId.toString(),
    guestName: value.guestName,
    email: value.guestEmail,
    phone: value.guestPhone,
    roomId: value.roomId.toString(),
    room: `${value.roomNumber} · ${value.roomType}`,
    roomNumber: value.roomNumber,
    roomType: value.roomType,
    checkIn: value.checkIn,
    checkOut: value.checkOut,
    status: value.status,
    total: value.total,
    nightlyRate: value.nightlyRate,
    adults: value.adults,
    children: value.children,
    travelingWithPets: value.travelingWithPets,
    createdAt: value.createdAt,
  };
}

router.get('/mine', requireAuth('guest'), async (req, res, next) => {
  try {
    const bookings = await Booking.find({ guestId: req.auth.userId }).sort({ checkIn: -1 }).lean();
    return res.json(bookings.map(bookingData));
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', requireAuth('admin'), async (req, res, next) => {
  try {
    const bookings = await Booking.find().sort({ checkIn: -1, createdAt: -1 }).lean();
    return res.json(bookings.map(bookingData));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth('guest'), async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide booking details.' });
    }
    const { roomId, checkIn, checkOut, adults, children, travelingWithPets } = req.body;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ message: 'Select a valid room.' });
    }
    if (!validDate(checkIn) || !validDate(checkOut) || checkIn < getHotelDateValue() || checkIn >= checkOut) {
      return res.status(400).json({ message: 'Choose a valid stay with check-out after check-in.' });
    }
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
      return res.status(400).json({ message: 'Enter a valid guest count.' });
    }
    if (travelingWithPets !== undefined && typeof travelingWithPets !== 'boolean') {
      return res.status(400).json({ message: 'Select a valid pet preference.' });
    }

    const [room, guest] = await Promise.all([
      Room.findById(roomId),
      User.findById(req.auth.userId).select('firstName lastName email phone role'),
    ]);
    if (!room) {
      return res.status(404).json({ message: 'The selected room no longer exists.' });
    }
    if (!guest || guest.role !== 'guest') {
      return res.status(401).json({ message: 'Sign in with a guest account to book a room.' });
    }
    if (room.statusOverride === 'Maintenance') {
      return res.status(409).json({ message: 'This room is under maintenance and cannot be booked.' });
    }
    if (adults + children > room.capacity) {
      return res.status(400).json({ message: `This room accommodates up to ${room.capacity} guest(s).` });
    }

    const booking = await withRoomBookingLock(room._id.toString(), async () => {
      const conflictingBooking = await Booking.findOne({
        roomId: room._id,
        status: { $in: activeStatuses },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      }).select('_id').lean();
      if (conflictingBooking) {
        return null;
      }

      const nights = (Date.parse(`${checkOut}T00:00:00.000Z`) - Date.parse(`${checkIn}T00:00:00.000Z`)) / 86_400_000;
      return Booking.create({
        guestId: guest._id,
        guestName: `${guest.firstName} ${guest.lastName}`,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        roomId: room._id,
        roomNumber: room.number,
        roomType: room.type,
        checkIn,
        checkOut,
        adults,
        children,
        travelingWithPets: travelingWithPets === true,
        nightlyRate: room.nightlyRate,
        total: room.nightlyRate * nights,
        status: 'Confirmed',
      });
    });
    if (!booking) {
      return res.status(409).json({ message: 'This room is no longer available for those dates.' });
    }
    return res.status(201).json(bookingData(booking));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/cancel', requireAuth('guest'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking identifier.' });
    }
    const today = getHotelDateValue();
    const booking = await Booking.findOne({
      _id: req.params.id,
      guestId: req.auth.userId,
      status: 'Confirmed',
      checkIn: { $gt: today },
    });
    if (!booking) {
      return res.status(404).json({ message: 'This booking cannot be cancelled.' });
    }
    booking.status = 'Cancelled';
    await booking.save();
    return res.json(bookingData(booking));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', requireAuth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking identifier.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide a booking status.' });
    }
    const { status } = req.body;
    if (!['Checked in', 'Checked out', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Select a valid booking status.' });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const today = getHotelDateValue();
    const validTransition = (
      (status === 'Checked in' && booking.status === 'Confirmed' && booking.checkIn <= today && booking.checkOut > today) ||
      (status === 'Checked out' && booking.status === 'Checked in') ||
      (status === 'Cancelled' && booking.status === 'Confirmed')
    );
    if (!validTransition) {
      return res.status(409).json({ message: 'That booking status change is not allowed.' });
    }
    booking.status = status;
    await booking.save();
    return res.json(bookingData(booking));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
