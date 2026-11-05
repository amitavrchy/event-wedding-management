import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { ownEvent, ownVendor, vendorAccess } from "./access";
import { amount, parse, z } from "./validation";
import { audit } from "./activity";
@Controller("contracts")
@UseGuards(AuthGuard)
export class ContractsController {
  constructor(private db: Database) {}
  @Get("event/:id") async event(@Req() req: any, @Param("id") id: string) {
    await ownEvent(this.db, id, req.user, "read");
    return this.db.contract.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
  }
  @Get("business") async business(@Req() req: any) {
    const vendors = await this.db.vendor.findMany({
      where: vendorAccess(req.user.sub),
      select: { id: true },
    });
    return this.db.contract.findMany({
      where: { vendorId: { in: vendors.map((v) => v.id) } },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const data = parse(
      z.object({
        eventId: z.string(),
        vendorId: z.string(),
        title: z.string().min(3).max(150),
        body: z.string().min(30).max(30000),
        amountMinor: amount,
      }),
      body,
    );
    await ownVendor(this.db, data.vendorId, req.user);
    if (
      !(await this.db.conversation.findUnique({
        where: {
          eventId_vendorId: { eventId: data.eventId, vendorId: data.vendorId },
        },
      }))
    )
      throw new ForbiddenException(
        "A client conversation is required before issuing a contract",
      );
    return this.db.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          ...data,
          contentHash: createHash("sha256")
            .update(JSON.stringify(data))
            .digest("hex"),
        },
      });
      await audit(
        tx,
        req.user,
        { eventId: data.eventId, vendorId: data.vendorId },
        "CONTRACT_SENT",
        data.title,
      );
      return contract;
    });
  }
  @Post(":id/sign") async sign(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({ name: z.string().min(2).max(100), accepted: z.literal(true) }),
      body,
    );
    const contract = await this.db.contract.findUniqueOrThrow({
      where: { id },
    });
    const event = await ownEvent(this.db, contract.eventId, req.user);
    if (event.hostId !== req.user.sub)
      throw new ForbiddenException(
        "Only the event owner can acknowledge this contract",
      );
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: req.user.sub },
    });
    if (data.name.trim().toLowerCase() !== user.fullName.trim().toLowerCase())
      throw new BadRequestException(
        "Type your full account name to acknowledge",
      );
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const current = await tx.contract.findUniqueOrThrow({ where: { id } });
      if (current.status !== "SENT")
        throw new BadRequestException(
          "Contract is already signed or withdrawn",
        );
      const result = await tx.contract.update({
        where: { id },
        data: {
          status: "SIGNED",
          signedBy: req.user.sub,
          signerName: user.fullName,
          signedAt: new Date(),
        },
      });
      await audit(
        tx,
        req.user,
        { eventId: event.id, vendorId: contract.vendorId },
        "CONTRACT_SIGNED",
        contract.title,
      );
      return result;
    });
  }
  @Post(":id/withdraw") async withdraw(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const contract = await this.db.contract.findUniqueOrThrow({
      where: { id },
    });
    await ownVendor(this.db, contract.vendorId, req.user);
    const result = await this.db.contract.updateMany({
      where: { id, status: "SENT" },
      data: { status: "WITHDRAWN" },
    });
    if (!result.count)
      throw new BadRequestException(
        "Signed contracts cannot be overwritten or withdrawn",
      );
    return result;
  }
}
