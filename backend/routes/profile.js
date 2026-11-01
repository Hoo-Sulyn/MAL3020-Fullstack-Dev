const express = require('express');
const bcrypt = require('bcryptjs');
const Booking = require('../models/booking');
const User = require('../models/user');
const requireAuth = require('../middleware/require-auth');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s-]{8,15}$/;

function profileData(user) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

router.use(requireAuth('guest'));

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.auth.userId, role: 'guest' });
    if (!user) {
      return res.status(404).json({ message: 'Guest account not found.' });
    }
    return res.json(profileData(user));
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Please provide valid profile details.' });
    }

    const { firstName, lastName, email, phone } = req.body;
    if (
      typeof firstName !== 'string' ||
      typeof lastName !== 'string' ||
      typeof email !== 'string' ||
      typeof phone !== 'string'
    ) {
      return res.status(400).json({ message: 'Please provide all profile details.' });
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    if (
      normalizedFirstName.length < 2 ||
      normalizedFirstName.length > 50 ||
      normalizedLastName.length < 2 ||
      normalizedLastName.length > 50 ||
      normalizedEmail.length > 254 ||
      !emailPattern.test(normalizedEmail) ||
      !phonePattern.test(normalizedPhone)
    ) {
      return res.status(400).json({ message: 'Enter valid name, email and phone details.' });
    }

    const user = await User.findOne({ _id: req.auth.userId, role: 'guest' });
    if (!user) {
      return res.status(404).json({ message: 'Guest account not found.' });
    }

    const duplicateEmail = await User.exists({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });
    if (duplicateEmail) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const nameChanged = user.firstName !== normalizedFirstName || user.lastName !== normalizedLastName;
    const emailChanged = user.email !== normalizedEmail;
    user.firstName = normalizedFirstName;
    user.lastName = normalizedLastName;
    user.email = normalizedEmail;
    user.phone = normalizedPhone;
    await user.save();

    if (nameChanged || emailChanged) {
      const updates = {};
      if (nameChanged) {
        updates.guestName = `${normalizedFirstName} ${normalizedLastName}`;
      }
      if (emailChanged) {
        updates.guestEmail = normalizedEmail;
      }
      await Booking.updateMany({ guestId: user._id }, { $set: updates });
    }

    return res.json(profileData(user));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    return next(error);
  }
});

router.put('/password', async (req, res, next) => {
  try {
    if (
      !req.body ||
      typeof req.body.currentPassword !== 'string' ||
      typeof req.body.newPassword !== 'string'
    ) {
      return res.status(400).json({ message: 'Provide your current password and a new password.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ message: 'Your new password must be at least 8 characters long.' });
    }

    const user = await User.findOne({ _id: req.auth.userId, role: 'guest' }).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'Guest account not found.' });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.delete('/account', async (req, res, next) => {
  try {
    const result = await User.deleteOne({ _id: req.auth.userId, role: 'guest' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Guest account not found.' });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
