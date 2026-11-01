const roomImages: Record<string, string> = {
  'Superior King': 'hotel-room-1.jpg',
  'Garden Suite': 'hotel-room-2.jpg',
  'River View Double': 'hotel-room-3.jpg',
};

export function getRoomImage(roomType: string): string {
  return roomImages[roomType] ?? 'image-not-available.png';
}
