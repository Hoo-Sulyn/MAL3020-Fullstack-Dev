require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s-]{8,15}$/;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Haven';
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Admin';
  const phone = process.env.ADMIN_PHONE?.trim() || '+60123456789';

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in backend/.env');
  }
  if (!email || !emailPattern.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL in backend/.env');
  }
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be between 8 and 72 UTF-8 bytes');
  }
  if (firstName.length < 2 || firstName.length > 50 || lastName.length < 2 || lastName.length > 50) {
    throw new Error('Admin first and last names must be between 2 and 50 characters');
  }
  if (!phonePattern.test(phone)) {
    throw new Error('Set a valid ADMIN_PHONE in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser.role !== 'admin') {
    throw new Error('That email already belongs to a non-admin account; choose a different ADMIN_EMAIL');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  if (existingUser) {
    existingUser.firstName = firstName;
    existingUser.lastName = lastName;
    existingUser.phone = phone;
    existingUser.password = passwordHash;
    await existingUser.save();
    console.log('Admin account updated. The password was saved as a bcrypt hash.');
    return;
  }

  await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: passwordHash,
    role: 'admin',
  });
  console.log('Admin account created. The password was saved as a bcrypt hash.');
}

seedAdmin()
  .catch((error) => {
    console.error('Unable to seed admin account:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
