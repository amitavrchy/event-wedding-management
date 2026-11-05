import { Prisma } from "@prisma/client";
import { Identity } from "./auth";
export function audit(
  db: Pick<Prisma.TransactionClient, "activity">,
  user: Identity,
  scope: { eventId?: string; vendorId?: string },
  action: string,
  detail: string,
) {
  return db.activity.create({
    data: {
      ...scope,
      actorId: user.sub,
      actorName: user.fullName || "Workspace member",
      action,
      detail,
    },
  });
}
