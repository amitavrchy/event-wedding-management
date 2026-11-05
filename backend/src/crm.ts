import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownVendor } from "./access";
import { amount, date, parse, z } from "./validation";
import { audit } from "./activity";
const fields = z.object({
  name: z.string().min(2).max(100),
  email: z.email().optional(),
  estimatedMinor: amount.default(0),
  eventDate: date.optional(),
  followUpAt: date.optional(),
  notes: z.string().max(5000).default(""),
});
@Controller("vendors/:id/leads")
@UseGuards(AuthGuard)
export class CrmController {
  constructor(private db: Database) {}
  @Get() async list(@Req() req: any, @Param("id") id: string) {
    await ownVendor(this.db, id, req.user, "read");
    return this.db.lead.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() async create(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    return this.db.lead.create({
      data: { ...parse(fields, body), vendorId: id },
    });
  }
  @Patch(":leadId") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Param("leadId") leadId: string,
    @Body() body: unknown,
  ) {
    await ownVendor(this.db, id, req.user);
    const data = parse(
      fields
        .partial()
        .extend({
          stage: z
            .enum(["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
            .optional(),
        }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const result = await tx.lead.updateMany({
        where: { id: leadId, vendorId: id },
        data,
      });
      if (data.stage)
        await audit(
          tx,
          req.user,
          { vendorId: id },
          "LEAD_STAGE_CHANGED",
          `${leadId}: ${data.stage}`,
        );
      return result;
    });
  }
  @Delete(":leadId") async remove(
    @Req() req: any,
    @Param("id") id: string,
    @Param("leadId") leadId: string,
  ) {
    await ownVendor(this.db, id, req.user);
    return this.db.lead.deleteMany({ where: { id: leadId, vendorId: id } });
  }
}
