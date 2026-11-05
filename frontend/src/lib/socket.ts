"use client";
import { io, Socket } from "socket.io-client";
let connection: Socket | undefined;
export function socket() {
  if (!connection)
    connection = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        auth: { token: sessionStorage.getItem("utsab-token") },
        autoConnect: false,
      },
    );
  return connection;
}
export function disconnect() {
  connection?.disconnect();
  connection = undefined;
}
