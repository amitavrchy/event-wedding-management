import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { Database } from "./prisma";
import { AuthGuard } from "./auth";
import { parse, z } from "./validation";
@Controller("categories")
export class CategoriesController {
  constructor(private db: Database) {}
  @Get() list() {
    return this.db.category.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
    });
  }
  @Post() @UseGuards(AuthGuard) create(@Req() req: any, @Body() body: unknown) {
    if (req.user.role !== "PLATFORM_ADMIN") throw new ForbiddenException();
    return this.db.category.upsert({
      where: {
        name: parse(z.object({ name: z.string().min(2).max(50) }), body).name,
      },
      create: {
        name: parse(z.object({ name: z.string().min(2).max(50) }), body).name,
      },
      update: { enabled: true },
    });
  }
  @Patch(":id") @UseGuards(AuthGuard) toggle(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (req.user.role !== "PLATFORM_ADMIN") throw new ForbiddenException();
    return this.db.category.update({
      where: { id },
      data: parse(z.object({ enabled: z.boolean() }), body),
    });
  }
}
