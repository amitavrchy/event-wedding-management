import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Database } from './prisma';
import { AuthGuard } from './auth';
import { ownEvent } from './access';
import { parse, z } from './validation';
const guestSchema=z.object({name:z.string().min(2).max(100),email:z.email().optional().or(z.literal('')),phone:z.string().max(25).optional(),maxPartySize:z.number().int().min(1).max(10).default(2)});
@Controller('events/:id/guests') @UseGuards(AuthGuard)
export class GuestsController {
  constructor(private db:Database) {}
  @Get() async list(@Req() req:any,@Param('id') id:string) {await ownEvent(this.db,id,req.user);return this.db.guest.findMany({where:{eventId:id},orderBy:{name:'asc'}});}
  @Post() async add(@Req() req:any,@Param('id') id:string,@Body() body:unknown) {await ownEvent(this.db,id,req.user);const data=parse(guestSchema,body);return this.db.guest.create({data:{...data,eventId:id,token:randomBytes(32).toString('hex')}});}
  @Post('import') async bulk(@Req() req:any,@Param('id') id:string,@Body() body:unknown) {await ownEvent(this.db,id,req.user);const {guests}=parse(z.object({guests:z.array(guestSchema).min(1).max(500)}),body);return this.db.guest.createMany({data:guests.map(g=>({...g,eventId:id,token:randomBytes(32).toString('hex')}))});}
  @Patch(':guestId') async seat(@Req() req:any,@Param('id') id:string,@Param('guestId') guestId:string,@Body() body:unknown) {await ownEvent(this.db,id,req.user);const data=parse(z.object({tableLabel:z.string().max(50)}),body);return this.db.guest.updateMany({where:{id:guestId,eventId:id},data});}
}
@Controller('rsvp')
export class RsvpController {
  constructor(private db:Database) {}
  @Get(':token') async get(@Param('token') token:string) {const guest=await this.db.guest.findUnique({where:{token},include:{event:{select:{title:true,days:true,rsvpDeadline:true}}}});if(!guest)throw new BadRequestException('Invitation not found');return {name:guest.name,rsvpStatus:guest.rsvpStatus,partySize:guest.partySize,maxPartySize:guest.maxPartySize,mealPreference:guest.mealPreference,event:guest.event};}
  @Post(':token') async respond(@Param('token') token:string,@Body() body:unknown) {const data=parse(z.object({rsvpStatus:z.enum(['ACCEPTED','DECLINED','MAYBE']),partySize:z.number().int().min(1).max(10),mealPreference:z.enum(['Regular','Vegetarian','No beef']).default('Regular')}),body);const guest=await this.db.guest.findUniqueOrThrow({where:{token},include:{event:true}});if(guest.event.rsvpDeadline&&guest.event.rsvpDeadline<new Date())throw new BadRequestException('RSVP deadline has passed');if(data.partySize>guest.maxPartySize)throw new BadRequestException('Party exceeds your invitation allowance');return this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${guest.eventId}))`;await tx.guest.update({where:{id:guest.id},data});const accepted=await tx.guest.aggregate({where:{eventId:guest.eventId,rsvpStatus:'ACCEPTED'},_sum:{partySize:true}});return {saved:true,capacityWarning:(accepted._sum.partySize||0)>guest.event.guestCapacity};});}
}
