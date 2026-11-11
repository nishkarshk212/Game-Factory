import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socketInstance) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000
  });

  return socketInstance;
}

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

