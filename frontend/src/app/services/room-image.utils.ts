const roomImages: Record<string, string> = {
  'Superior King': 'city-view.jpg',
  'Garden Suite': 'garden-view.jpg',
  'River View Double': 'river-view.jpg',
};

export function getRoomImage(roomType: string): string {
  return roomImages[roomType] ?? 'image-not-available.png';
}
