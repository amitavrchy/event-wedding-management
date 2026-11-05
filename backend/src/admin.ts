import { Body, Controller, Get, Param, Patch, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { Database } from './prisma';
import { AuthGuard } from './auth';
import { parse, z } from './validation';
@Controller('admin') @UseGuards(AuthGuard)
export class AdminController {
  constructor(private db:Database) {}
  private admin(req:any) {if(req.user.role!=='PLATFORM_ADMIN')throw new ForbiddenException();}
  @Get('vendors') vendors(@Req() req:any) {this.admin(req);return this.db.vendor.findMany({include:{services:true}});}
  @Patch('vendors/:id') update(@Req() req:any,@Param('id') id:string,@Body() body:unknown) {this.admin(req);const data=parse(z.object({status:z.enum(['ACTIVE','SUSPENDED']).optional(),commissionBps:z.number().int().min(0).max(5000).optional()}),body);return this.db.vendor.update({where:{id},data});}
  @Get('ledger') ledger(@Req() req:any) {this.admin(req);return this.db.ledgerEntry.findMany({orderBy:{createdAt:'desc'}});}
  @Patch('ledger/:id/paid') paid(@Req() req:any,@Param('id') id:string) {this.admin(req);return this.db.ledgerEntry.update({where:{id,status:'PENDING'},data:{status:'PAID'}});}
}
