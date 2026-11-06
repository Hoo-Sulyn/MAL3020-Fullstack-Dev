import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingChangeEvent, RealtimeService } from '../../app/services/realtime.service';

const socketMocks = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
      return socket;
    }),
    disconnect: vi.fn(),
  };
  const io = vi.fn((_url: string, _options: {
    transports: string[];
    auth: (callback: (auth: { token: string | null }) => void) => void;
  }) => socket);
  return { listeners, socket, io };
});

vi.mock('socket.io-client', () => ({ io: socketMocks.io }));

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    localStorage.clear();
    socketMocks.listeners.clear();
    socketMocks.io.mockClear();
    socketMocks.socket.on.mockClear();
    socketMocks.socket.disconnect.mockClear();
    service = new RealtimeService();
  });

  afterEach(() => {
    service.disconnect();
    localStorage.clear();
  });

  it('stores the token and opens an authenticated WebSocket connection', async () => {
    service.connect('test-token');
    await vi.waitFor(() => expect(socketMocks.io).toHaveBeenCalledOnce());

    const [, options] = socketMocks.io.mock.calls[0];
    let authToken: string | null = null;
    options.auth((auth) => {
      authToken = auth.token;
    });

    expect(service.getToken()).toBe('test-token');
    expect(authToken).toBe('test-token');
    expect(options.transports).toEqual(['websocket']);
  });

  it('publishes booking changes received from the socket', async () => {
    const receivedEvents: BookingChangeEvent[] = [];
    service.connect('test-token');
    service.bookingChanges().subscribe((event) => receivedEvents.push(event));
    await vi.waitFor(() => expect(socketMocks.io).toHaveBeenCalledOnce());

    socketMocks.listeners.get('booking:changed')?.({
      action: 'updated',
      id: 'booking-123',
    });

    expect(receivedEvents).toEqual([{ action: 'updated', id: 'booking-123' }]);
  });

  it('clears the token and closes the socket on disconnect', async () => {
    service.connect('test-token');
    await vi.waitFor(() => expect(socketMocks.io).toHaveBeenCalledOnce());

    service.disconnect();

    expect(service.getToken()).toBeNull();
    expect(service.isConnected()).toBe(false);
    expect(socketMocks.socket.disconnect).toHaveBeenCalledOnce();
  });
});
