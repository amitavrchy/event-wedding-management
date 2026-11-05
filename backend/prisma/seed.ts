import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
const db=new PrismaClient();
async function seed(){
 const passwordHash=await hash('UtsabDemo2027!',12);
 const host=await db.user.upsert({where:{email:'host@utsab.local'},update:{},create:{email:'host@utsab.local',fullName:'Ayesha Rahman',passwordHash,role:'HOST'}});
 const vendor=await db.user.upsert({where:{email:'vendor@utsab.local'},update:{},create:{email:'vendor@utsab.local',fullName:'Farhan Ahmed',passwordHash,role:'VENDOR'}});
 const entries=[
 ['the-grand-palace','The Grand Palace','Venue','A light-filled ballroom, garden ceremonies, and thoughtful hospitality in the heart of Dhaka.',25000000,'photo-1519167758481-83f550bb49b3'],
 ['stories-by-light','Stories by Light','Photography','Honest moments, beautifully told. Documentary wedding photography and cinematic films.',8500000,'photo-1511285560929-80b456fea0bc'],
 ['bloom-and-beyond','Bloom & Beyond','Decoration','Florals, light, and a little magic. Bespoke settings for your most meaningful celebrations.',12000000,'photo-1519741497674-611481863552'],
 ['royal-feast','Royal Feast','Catering','From traditional kacchi to beautifully curated menus, a feast your guests will remember.',18000000,'photo-1555244162-803834f70033'],
 ['rosewood-estate','Rosewood Estate','Venue','An intimate garden estate with open skies and warm, personal service.',32000000,'photo-1511795409834-ef04bbd61622'],
 ['the-beauty-edit','The Beauty Edit','Makeup','Natural radiance and timeless bridal looks, tailored to you.',3500000,'photo-1596462502278-27bfdc403348']
 ] as const;
 for(const [slug,businessName,category,description,price,image] of entries){const v=await db.vendor.upsert({where:{slug},update:{},create:{slug,businessName,category,description,image:`https://images.unsplash.com/${image}?auto=format&fit=crop&w=1200&q=85`,ownerId:vendor.id,status:'ACTIVE'}});await db.vendorService.upsert({where:{id:`service-${slug}`},update:{},create:{id:`service-${slug}`,vendorId:v.id,title:`${businessName} signature service`,basePriceMinor:price,durationHours:6,bufferHours:2,capacity:category==='Venue'?400:undefined}});}
 const event=await db.event.upsert({where:{id:'event-ayesha-raihan'},update:{},create:{id:'event-ayesha-raihan',hostId:host.id,title:'Ayesha & Raihan',budgetMinor:150000000,guestCapacity:350,rsvpDeadline:new Date('2027-02-01T18:00:00+06:00')}});
 for(const [id,name,date,venue] of [['holud','Gaye Holud','2027-02-12','Rosewood Estate'],['wedding','Wedding ceremony','2027-02-14','The Grand Palace'],['reception','Reception','2027-02-16','The Grand Palace']])await db.eventDay.upsert({where:{id:`day-${id}`},update:{},create:{id:`day-${id}`,eventId:event.id,name,startsAt:new Date(`${date}T18:00:00+06:00`),endsAt:new Date(`${date}T23:00:00+06:00`),venueName:venue}});
 for(const [i,title,done] of [[1,'Find the perfect venue',true],[2,'Shortlist wedding photographers',true],[3,'Send your wedding invitations',false],[4,'Finalize the catering menu',false],[5,'Book the bridal makeup artist',false],[6,'Choose your floral palette',false]] as const)await db.checklistItem.upsert({where:{id:`task-${i}`},update:{},create:{id:`task-${i}`,eventId:event.id,title,done,dueAt:new Date('2027-01-15T12:00:00+06:00')}});
 for(const [category,plannedMinor] of [['Venue',45000000],['Catering',40000000],['Decoration',25000000],['Photography',15000000],['Attire',15000000],['Other',10000000]] as const)await db.budgetItem.upsert({where:{eventId_category:{eventId:event.id,category}},update:{},create:{eventId:event.id,category,plannedMinor}});
 const guests=['Nusrat Jahan','Tanvir Hasan','Sadia Islam','Arif Rahman','Mehjabin Chowdhury','Fahim Ahmed','Sara Karim','Rafiq Uddin'];
 for(const [i,name] of guests.entries())await db.guest.upsert({where:{id:`guest-${i}`},update:{},create:{id:`guest-${i}`,eventId:event.id,name,email:`guest${i+1}@example.com`,token:randomBytes(32).toString('hex'),rsvpStatus:i<4?'ACCEPTED':i===7?'DECLINED':'INVITED',partySize:i%2+1,maxPartySize:2,tableLabel:i<4?`Table ${Math.floor(i/2)+1}`:undefined}});
 const services=await db.vendorService.findMany({take:3,orderBy:{id:'asc'}});
 await db.package.upsert({where:{id:'package-signature'},update:{},create:{id:'package-signature',title:'The Signature Celebration',description:'A beautifully coordinated venue, florals, and photography collection.',serviceIds:services.map(s=>s.id),discountBps:800}});
 console.log('Seed ready. Local host/vendor: host@utsab.local / vendor@utsab.local; password: UtsabDemo2027!');
}
seed().finally(()=>db.$disconnect());
