import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function getHotelDateValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

export function getNextDateValue(date: string): string {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

export function hotelDateRangeValidator(checkInKey: string, checkOutKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const checkIn = control.get(checkInKey)?.value;
    const checkOut = control.get(checkOutKey)?.value;
    if (typeof checkIn === 'string' && checkIn && checkIn < getHotelDateValue()) {
      return { checkInInPast: true };
    }
    if (typeof checkIn === 'string' && checkIn && typeof checkOut === 'string' && checkOut && checkOut <= checkIn) {
      return { checkOutNotAfterCheckIn: true };
    }
    return null;
  };
}
