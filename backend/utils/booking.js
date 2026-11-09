function isValidBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function toBookingResponse(booking) {
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

module.exports = { isValidBookingDate, toBookingResponse };
