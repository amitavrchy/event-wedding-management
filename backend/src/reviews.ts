import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent } from "./access";
import { parse, z } from "./validation";
@Controller("reviews")
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(private db: Database) {}
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        bookingId: z.string(),
        rating: z.number().int().min(1).max(5),
        body: z.string().min(5).max(2000),
      }),
      body,
    );
    const booking = await this.db.booking.findUniqueOrThrow({
      where: { id: data.bookingId },
    });
    await ownEvent(this.db, booking.eventId, req.user);
    if (booking.status !== "COMPLETED")
      throw new BadRequestException(
        "Reviews open after your booking is completed",
      );
    return this.db.review.create({
      data: { ...data, vendorId: booking.vendorId, hostId: req.user.sub },
    });
  }
}
