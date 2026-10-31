const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const Room = require('../models/room');
const requireAuth = require('../middleware/require-auth');
const { getHotelDateValue } = require('../utils/date');

const router = express.Router();
const roomTypes = ['Superior King', 'Garden Suite', 'River View Double'];
const roomStatuses = ['Automatic', 'Available', 'Occupied', 'Maintenance'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dateRangeIsValid(checkIn, checkOut) {
  return validDate(checkIn) && validDate(checkOut) && checkIn < checkOut;
}

function roomData(room, status = room.statusOverride) {
  return {
    id: room._id.toString(),
    number: room.number,
    type: room.type,
    floor: room.floor,
    description: room.description,
    amenities: room.amenities,
    capacity: room.capacity,
    nightlyRate: room.nightlyRate,
    status,
    statusOverride: room.statusOverride,
  };
}

async function getOccupiedRoomIds(date) {
  const bookings = await Booking.find({
    checkIn: { $lte: date },
    checkOut: { $gt: date },
    status: { $in: ['Confirmed', 'Checked in'] },
  }).select('roomId').lean();
  return new Set(bookings.map((booking) => booking.roomId.toString()));
}

router.get('/admin', requireAuth('admin'), async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ number: 1 }).lean();
    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    return res.json(rooms.map((room) => {
      const status = room.statusOverride === 'Automatic'
        ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
        : room.statusOverride;
      return roomData(room, status);
    }));
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { checkIn, checkOut, adults } = req.query;
    const hasCheckIn = checkIn !== undefined;
    const hasCheckOut = checkOut !== undefined;
    if (hasCheckIn !== hasCheckOut || (hasCheckIn && !dateRangeIsValid(checkIn, checkOut))) {
      return res.status(400).json({ message: 'Please provide a valid check-in and check-out date.' });
    }

    const capacity = adults === undefined ? 1 : Number(adults);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ message: 'The guest count must be a positive whole number.' });
    }

    const rooms = await Room.find({
      capacity: { $gte: capacity },
      statusOverride: { $ne: 'Maintenance' },
    }).sort({ nightlyRate: 1, number: 1 }).lean();

    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    const currentStatuses = (availableRooms) => availableRooms.map((room) => roomData(
      room,
      room.statusOverride === 'Automatic'
        ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
        : room.statusOverride
    ));

    if (!hasCheckIn) {
      return res.json(currentStatuses(rooms));
    }

    const unavailableBookings = await Booking.find({
      status: { $in: ['Confirmed', 'Checked in'] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    }).select('roomId').lean();
    const unavailableIds = new Set(unavailableBookings.map((booking) => booking.roomId.toString()));
    return res.json(currentStatuses(rooms.filter((room) => !unavailableIds.has(room._id.toString()))));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room identifier.' });
    }
    const room = await Room.findById(req.params.id).lean();
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    const status = room.statusOverride === 'Automatic'
      ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
      : room.statusOverride;
    return res.json(roomData(room, status));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth('admin'), async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide room details.' });
    }
    const { number, type, floor, description, amenities, capacity, nightlyRate, status } = req.body;
    if (
      typeof number !== 'string' ||
      typeof type !== 'string' ||
      typeof description !== 'string' ||
      typeof amenities !== 'string'
    ) {
      return res.status(400).json({ message: 'Please provide all required room details.' });
    }

    const normalizedNumber = number.trim();
    const normalizedDescription = description.trim();
    const normalizedAmenities = amenities.trim();
    if (!normalizedNumber || normalizedNumber.length > 20) {
      return res.status(400).json({ message: 'Enter a room number up to 20 characters long.' });
    }
    if (!roomTypes.includes(type)) {
      return res.status(400).json({ message: 'Select a valid room type.' });
    }
    if (!Number.isInteger(floor) || floor < 0) {
      return res.status(400).json({ message: 'Floor must be a non-negative whole number.' });
    }
    if (!normalizedDescription || normalizedDescription.length > 500) {
      return res.status(400).json({ message: 'Enter a description up to 500 characters long.' });
    }
    if (!normalizedAmenities || normalizedAmenities.length > 500) {
      return res.status(400).json({ message: 'Enter amenities up to 500 characters long.' });
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ message: 'Capacity must be a positive whole number.' });
    }
    if (typeof nightlyRate !== 'number' || !Number.isFinite(nightlyRate) || nightlyRate < 0) {
      return res.status(400).json({ message: 'Nightly rate must be a non-negative number.' });
    }
    if (status !== undefined && !roomStatuses.includes(status)) {
      return res.status(400).json({ message: 'Select a valid room status.' });
    }

    const existingRoom = await Room.findOne({ number: normalizedNumber }).select('_id').lean();
    if (existingRoom) {
      return res.status(409).json({ message: 'That room number already exists.' });
    }

    const room = await Room.create({
      number: normalizedNumber,
      type,
      floor,
      description: normalizedDescription,
      amenities: normalizedAmenities,
      capacity,
      nightlyRate,
      statusOverride: status || 'Automatic',
    });
    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    const effectiveStatus = room.statusOverride === 'Automatic'
      ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
      : room.statusOverride;
    return res.status(201).json(roomData(room, effectiveStatus));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'That room number already exists.' });
    }
    return next(error);
  }
});

router.put('/:id', requireAuth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room identifier.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide room details.' });
    }
    const { number, type, floor, description, amenities, capacity, nightlyRate, status } = req.body;
    if (
      typeof number !== 'string' ||
      typeof type !== 'string' ||
      typeof description !== 'string' ||
      typeof amenities !== 'string'
    ) {
      return res.status(400).json({ message: 'Please provide all required room details.' });
    }

    const normalizedNumber = number.trim();
    const normalizedDescription = description.trim();
    const normalizedAmenities = amenities.trim();
    if (!normalizedNumber || normalizedNumber.length > 20) {
      return res.status(400).json({ message: 'Enter a room number up to 20 characters long.' });
    }
    if (!roomTypes.includes(type)) {
      return res.status(400).json({ message: 'Select a valid room type.' });
    }
    if (!Number.isInteger(floor) || floor < 0) {
      return res.status(400).json({ message: 'Floor must be a non-negative whole number.' });
    }
    if (!normalizedDescription || normalizedDescription.length > 500) {
      return res.status(400).json({ message: 'Enter a description up to 500 characters long.' });
    }
    if (!normalizedAmenities || normalizedAmenities.length > 500) {
      return res.status(400).json({ message: 'Enter amenities up to 500 characters long.' });
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ message: 'Capacity must be a positive whole number.' });
    }
    if (typeof nightlyRate !== 'number' || !Number.isFinite(nightlyRate) || nightlyRate < 0) {
      return res.status(400).json({ message: 'Nightly rate must be a non-negative number.' });
    }
    if (!roomStatuses.includes(status)) {
      return res.status(400).json({ message: 'Select a valid room status.' });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      {
        number: normalizedNumber,
        type,
        floor,
        description: normalizedDescription,
        amenities: normalizedAmenities,
        capacity,
        nightlyRate,
        statusOverride: status,
      },
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    const effectiveStatus = room.statusOverride === 'Automatic'
      ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
      : room.statusOverride;
    return res.json(roomData(room, effectiveStatus));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'That room number already exists.' });
    }
    return next(error);
  }
});

router.patch('/:id/status', requireAuth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room identifier.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide a room status.' });
    }
    const { status } = req.body;
    if (!roomStatuses.includes(status)) {
      return res.status(400).json({ message: 'Select a valid room status.' });
    }
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { statusOverride: status },
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    const occupiedIds = await getOccupiedRoomIds(getHotelDateValue());
    const effectiveStatus = room.statusOverride === 'Automatic'
      ? (occupiedIds.has(room._id.toString()) ? 'Occupied' : 'Available')
      : room.statusOverride;
    return res.json(roomData(room, effectiveStatus));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room identifier.' });
    }
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
