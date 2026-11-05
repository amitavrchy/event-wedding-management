import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Database } from './prisma';
import { Identity } from './auth';
export async function ownEvent(db: Database, id: string, user: Identity) { const event = await db.event.findUnique({where:{id}}); if (!event) throw new NotFoundException('Event not found'); if(event.hostId !== user.sub && user.role !== 'PLATFORM_ADMIN') throw new ForbiddenException(); return event; }
export async function ownVendor(db: Database, id: string, user: Identity) { const vendor = await db.vendor.findUnique({where:{id}}); if (!vendor) throw new NotFoundException('Vendor not found'); if(vendor.ownerId !== user.sub && user.role !== 'PLATFORM_ADMIN') throw new ForbiddenException(); return vendor; }
