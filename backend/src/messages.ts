import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Database } from './prisma';
import { AuthGuard, Identity } from './auth';
import { ownEvent, ownVendor } from './access';
import { parse, z } from './validation';
@Controller('conversations') @UseGuards(AuthGuard)
export class MessagesController {
  constructor(private db:Database) {}
  @Get() list(@Req() req:any) {return this.db.conversation.findMany({where:req.user.role==='VENDOR'?{vendorId:{in:undefined}}:{eventId:{in:undefined}}}).then(async rows=>{const ids=req.user.role==='VENDOR'?(await this.db.vendor.findMany({where:{ownerId:req.user.sub},select:{id:true}})).map(v=>v.id):(await this.db.event.findMany({where:{hostId:req.user.sub},select:{id:true}})).map(e=>e.id);return rows.filter(c=>ids.includes(req.user.role==='VENDOR'?c.vendorId:c.eventId));});}
  @Post() async open(@Req() req:any,@Body() body:unknown) {const data=parse(z.object({eventId:z.string(),vendorId:z.string()}),body);await ownEvent(this.db,data.eventId,req.user);if(!await this.db.vendor.findFirst({where:{id:data.vendorId,status:'ACTIVE'}}))throw new BadRequestException('Vendor unavailable');return this.db.conversation.upsert({where:{eventId_vendorId:data},create:data,update:{}});}
  @Get(':id/messages') async messages(@Req() req:any,@Param('id') id:string) {await this.access(id,req.user);return this.db.message.findMany({where:{conversationId:id},orderBy:{createdAt:'asc'},take:200});}
  @Post(':id/messages') async send(@Req() req:any,@Param('id') id:string,@Body() body:unknown) {await this.access(id,req.user);const data=parse(z.object({body:z.string().trim().min(1).max(4000)}),body);return this.db.message.create({data:{...data,conversationId:id,senderId:req.user.sub}});}
  async access(id:string,user:Identity) {const c=await this.db.conversation.findUniqueOrThrow({where:{id}});if(user.role==='VENDOR')await ownVendor(this.db,c.vendorId,user);else await ownEvent(this.db,c.eventId,user);return c;}
}
