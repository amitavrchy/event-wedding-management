import { Server } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Database } from "./prisma";
import { Identity } from "./auth";
import { ownEvent, ownVendor } from "./access";
let broadcast: Server | undefined;
export function disconnectUser(userId: string) {
  broadcast?.in(`user:${userId}`).disconnectSockets(true);
}
export function publishMessage(room: string, message: unknown) {
  broadcast?.to(room).emit("message", message);
}
export async function publishBooking(
  db: Database,
  eventId: string,
  vendorId: string,
) {
  const [event, vendor] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    db.vendor.findUnique({ where: { id: vendorId } }),
  ]);
  for (const id of [event?.hostId, vendor?.ownerId])
    if (id) broadcast?.to(`user:${id}`).emit("booking:update", { eventId });
}
export function realtime(
  server: any,
  db: Database,
  jwt: JwtService,
  origins: string[],
) {
  const io = new Server(server, { cors: { origin: origins } });
  broadcast = io;
  io.use(async (socket, next) => {
    try {
      socket.data.user = await jwt.verifyAsync(socket.handshake.auth.token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
    socket.on("disconnect", () => {
      for (const timer of roomTimers.values()) clearTimeout(timer);
    });
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, (socket.data.user.exp || 0) * 1000 - Date.now()),
    );
    expiry.unref();
    socket.on("disconnect", () => clearTimeout(expiry));
    void socket.join(`user:${socket.data.user.sub}`);
    let count = 0,
      reset = Date.now() + 60000;
    socket.use((packet, next) => {
      if (Date.now() > reset) {
        count = 0;
        reset = Date.now() + 60000;
      }
      if (++count > 60) return next(new Error("Message rate limit exceeded"));
      next();
    });
    socket.on("leave", (id: string) => {
      const timer = roomTimers.get(id);
      if (timer) clearTimeout(timer);
      roomTimers.delete(id);
      if (typeof id === "string" && !id.startsWith("user:"))
        void socket.leave(id);
    });
    socket.on("join", async (id: string, ack: (value: any) => void) => {
      try {
        if (typeof id !== "string" || id.length > 100)
          throw new Error("Invalid room");
        const c = await db.conversation.findUniqueOrThrow({ where: { id } });
        const user = socket.data.user as Identity;
        const grant =
          user.role === "VENDOR"
            ? await ownVendor(db, c.vendorId, user, "read")
            : await ownEvent(db, c.eventId, user, "read");
        await socket.join(id);
        const previous = roomTimers.get(id);
        if (previous) clearTimeout(previous);
        if (grant.accessExpiresAt) {
          const timer = setTimeout(
            () => void socket.leave(id),
            Math.max(
              0,
              Math.min(2147483647, +grant.accessExpiresAt - Date.now()),
            ),
          );
          timer.unref();
          roomTimers.set(id, timer);
        }
        typeof ack === "function" && ack({ ok: true });
      } catch {
        typeof ack === "function" && ack({ error: "Access denied" });
      }
    });
    socket.on(
      "message",
      async (
        data: { conversationId: string; body: string },
        ack: (value: any) => void,
      ) => {
        try {
          if (
            !data ||
            !socket.rooms.has(data.conversationId) ||
            typeof data.body !== "string" ||
            !data.body.trim() ||
            data.body.length > 4000
          )
            throw new Error();
          const conversation = await db.conversation.findUniqueOrThrow({
            where: { id: data.conversationId },
          });
          const user = socket.data.user as Identity;
          if (user.role === "VENDOR")
            await ownVendor(db, conversation.vendorId, user);
          else await ownEvent(db, conversation.eventId, user);
          const message = await db.message.create({
            data: {
              conversationId: data.conversationId,
              body: data.body.trim(),
              senderId: socket.data.user.sub,
            },
          });
          io.to(data.conversationId).emit("message", message);
          typeof ack === "function" && ack({ ok: true });
        } catch {
          typeof ack === "function" &&
            ack({ error: "Message could not be sent" });
        }
      },
    );
  });
  return io;
}
