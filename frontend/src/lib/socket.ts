"use client";
import { io, Socket } from "socket.io-client";
import { api } from "./api";

/**
 * Socket.IO runs on the API host, where the session cookies are not sent, so
 * the browser fetches a two-minute socket token and presents it on connect.
 */
let connection: Socket | undefined;
const socketToken = () =>
  api<{ token: string }>("auth/socket-token").then((r) => r.token);

export function socket() {
  if (!connection) {
    connection = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        autoConnect: false,
        auth: (callback) => {
          socketToken()
            .then((token) => callback({ token }))
            .catch(() => callback({}));
        },
      },
    );
  }
  return connection;
}

export function disconnect() {
  connection?.disconnect();
  connection = undefined;
}
