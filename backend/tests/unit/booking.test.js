const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidBookingDate, toBookingResponse } = require('../../utils/booking');

test('booking date validation accepts valid ISO calendar dates', () => {
  assert.equal(isValidBookingDate('2028-02-29'), true);
  assert.equal(isValidBookingDate('2027-12-31'), true);
});

test('booking date validation rejects malformed and impossible dates', () => {
  assert.equal(isValidBookingDate('2027-02-29'), false);
  assert.equal(isValidBookingDate('2027-13-01'), false);
  assert.equal(isValidBookingDate('01-12-2027'), false);
  assert.equal(isValidBookingDate(null), false);
});

test('booking response maps database fields to the API shape', () => {
  const createdAt = new Date('2027-01-01T00:00:00.000Z');
  const booking = {
    _id: '0123456789abcdef01234567',
    guestId: '1123456789abcdef01234567',
    guestName: 'Test Guest',
    guestEmail: 'guest@example.com',
    guestPhone: '+60123456789',
    roomId: '2123456789abcdef01234567',
    roomNumber: '101',
    roomType: 'Superior King',
    checkIn: '2027-02-01',
    checkOut: '2027-02-03',
    status: 'Confirmed',
    total: 400,
    nightlyRate: 200,
    adults: 2,
    children: 0,
    travelingWithPets: false,
    createdAt,
  };

  assert.deepEqual(toBookingResponse(booking), {
    id: '0123456789abcdef01234567',
    bookingId: 'HV-234567',
    guestId: '1123456789abcdef01234567',
    guestName: 'Test Guest',
    email: 'guest@example.com',
    phone: '+60123456789',
    roomId: '2123456789abcdef01234567',
    room: '101 · Superior King',
    roomNumber: '101',
    roomType: 'Superior King',
    checkIn: '2027-02-01',
    checkOut: '2027-02-03',
    status: 'Confirmed',
    total: 400,
    nightlyRate: 200,
    adults: 2,
    children: 0,
    travelingWithPets: false,
    createdAt,
  });
});

test('booking response supports Mongoose documents', () => {
  const booking = {
    _id: '0123456789abcdef01234567',
    guestId: '1123456789abcdef01234567',
    roomId: '2123456789abcdef01234567',
    toObject() {
      return {
        _id: this._id,
        guestId: this.guestId,
        guestName: 'Test Guest',
        guestEmail: 'guest@example.com',
        guestPhone: '+60123456789',
        roomId: this.roomId,
        roomNumber: '101',
        roomType: 'Superior King',
        checkIn: '2027-02-01',
        checkOut: '2027-02-03',
        status: 'Confirmed',
        total: 400,
        nightlyRate: 200,
        adults: 2,
        children: 0,
        travelingWithPets: false,
        createdAt: new Date('2027-01-01T00:00:00.000Z'),
      };
    },
  };

  assert.equal(toBookingResponse(booking).bookingId, 'HV-234567');
});
