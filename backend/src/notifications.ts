import { Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private db: Database) {}
  @Get() list(@Req() req: any) {
    return this.db.notification.findMany({
      where: { recipientId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  @Patch(":id/read") read(@Req() req: any, @Param("id") id: string) {
    return this.db.notification.updateMany({
      where: { id, recipientId: req.user.sub },
      data: { read: true },
    });
  }
}
