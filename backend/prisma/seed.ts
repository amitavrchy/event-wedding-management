import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { templateFor, allocateBudget } from "../src/event-templates";
const db = new PrismaClient();
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production");
  const passwordHash = await hash("UtsabDemo2027!", 12);
  const host = await db.user.upsert({
    where: { email: "host@utsab.local" },
    update: {},
    create: {
      email: "host@utsab.local",
      fullName: "Ayesha Rahman",
      passwordHash,
      role: "HOST",
    },
  });
  const vendor = await db.user.upsert({
    where: { email: "vendor@utsab.local" },
    update: {},
    create: {
      email: "vendor@utsab.local",
      fullName: "Farhan Ahmed",
      passwordHash,
      role: "VENDOR",
    },
  });
  await db.user.upsert({
    where: { email: "admin@utsab.local" },
    update: {},
    create: {
      email: "admin@utsab.local",
      fullName: "Utsab Administrator",
      passwordHash,
      role: "PLATFORM_ADMIN",
    },
  });
  const entries = [
    [
      "the-cake-studio",
      "The Cake Studio",
      "Cake & desserts",
      "Development sample: themed birthday cakes, anniversary desserts, and party tables.",
      1200000,
      "photo-1513151233558-d860c5398176",
    ],
    [
      "play-and-party",
      "Play & Party",
      "Entertainment",
      "Development sample: games, hosts, music, and family-friendly entertainment.",
      2500000,
      "photo-1511988617509-a57c8a288659",
    ],
    [
      "stage-and-sound",
      "Stage & Sound",
      "AV & production",
      "Development sample: microphones, screens, lighting, and conference production.",
      6000000,
      "photo-1511578314322-379afb476865",
    ],
    [
      "gathering-planners",
      "Gathering Planners",
      "Event planning",
      "Development sample: company offsites, community gatherings, and celebration coordination.",
      4000000,
      "photo-1511795409834-ef04bbd61622",
    ],
    [
      "the-grand-palace",
      "The Grand Palace",
      "Venue",
      "A light-filled ballroom, garden ceremonies, and thoughtful hospitality in the heart of Dhaka.",
      25000000,
      "photo-1519167758481-83f550bb49b3",
    ],
    [
      "stories-by-light",
      "Stories by Light",
      "Photography",
      "Honest moments, beautifully told. Documentary wedding photography and cinematic films.",
      8500000,
      "photo-1511285560929-80b456fea0bc",
    ],
    [
      "bloom-and-beyond",
      "Bloom & Beyond",
      "Decoration",
      "Florals, light, and a little magic. Bespoke settings for your most meaningful celebrations.",
      12000000,
      "photo-1519741497674-611481863552",
    ],
    [
      "royal-feast",
      "Royal Feast",
      "Catering",
      "From traditional kacchi to beautifully curated menus, a feast your guests will remember.",
      18000000,
      "photo-1555244162-803834f70033",
    ],
    [
      "rosewood-estate",
      "Rosewood Estate",
      "Venue",
      "An intimate garden estate with open skies and warm, personal service.",
      32000000,
      "photo-1511795409834-ef04bbd61622",
    ],
    [
      "the-beauty-edit",
      "The Beauty Edit",
      "Makeup",
      "Natural radiance and timeless bridal looks, tailored to you.",
      3500000,
      "photo-1596462502278-27bfdc403348",
    ],
  ] as const;
  for (const name of [
    "Venue",
    "Photography",
    "Catering",
    "Decoration",
    "Makeup",
    "Cake & desserts",
    "Entertainment",
    "AV & production",
    "Event planning",
  ])
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
  for (const [
    slug,
    businessName,
    category,
    description,
    price,
    image,
  ] of entries) {
    const v = await db.vendor.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        businessName,
        category,
        description,
        image: `https://images.unsplash.com/${image}?auto=format&fit=crop&w=1200&q=85`,
        ownerId: vendor.id,
        status: "ACTIVE",
      },
    });
    await db.vendorService.upsert({
      where: { id: `service-${slug}` },
      update: {},
      create: {
        id: `service-${slug}`,
        vendorId: v.id,
        title: `${businessName} signature service`,
        basePriceMinor: price,
        durationHours: 6,
        bufferHours: 2,
        capacity: category === "Venue" ? 400 : undefined,
      },
    });
  }
  const event = await db.event.upsert({
    where: { id: "event-ayesha-raihan" },
    update: {},
    create: {
      id: "event-ayesha-raihan",
      hostId: host.id,
      title: "Ayesha & Raihan",
      eventType: "WEDDING",
      budgetMinor: 150000000,
      guestCapacity: 350,
      rsvpDeadline: new Date("2027-02-01T18:00:00+06:00"),
    },
  });
  for (const [id, type, title, offset] of [
    ["event-birthday-demo", "BIRTHDAY", "Riya's big 3-0", 60],
    ["event-anniversary-demo", "ANNIVERSARY", "Ten years together", 90],
    ["event-corporate-demo", "CORPORATE", "Dhaka Creative team day", 120],
  ] as const) {
    const template = templateFor(type),
      startsAt = new Date(Date.now() + offset * 86400000);
    await db.event.upsert({
      where: { id },
      update: {},
      create: {
        id,
        hostId: host.id,
        title,
        eventType: type,
        city: "Dhaka",
        budgetMinor: template.budgetMinor,
        guestCapacity: template.guestCapacity,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        tasks: { create: template.checklist.map((title) => ({ title })) },
        budget: {
          create: allocateBudget(template.budgetMinor, template.allocations),
        },
        days: {
          create: {
            name: template.dayName,
            startsAt,
            endsAt: new Date(+startsAt + template.durationHours * 3600000),
          },
        },
      },
    });
  }
  const grand = await db.vendor.findUniqueOrThrow({
    where: { slug: "the-grand-palace" },
  });
  await db.conversation.upsert({
    where: { eventId_vendorId: { eventId: event.id, vendorId: grand.id } },
    update: {},
    create: { eventId: event.id, vendorId: grand.id },
  });
  for (const [id, name, date, venue] of [
    ["holud", "Gaye Holud", "2027-02-12", "Rosewood Estate"],
    ["wedding", "Wedding ceremony", "2027-02-14", "The Grand Palace"],
    ["reception", "Reception", "2027-02-16", "The Grand Palace"],
  ])
    await db.eventDay.upsert({
      where: { id: `day-${id}` },
      update: {},
      create: {
        id: `day-${id}`,
        eventId: event.id,
        name,
        startsAt: new Date(`${date}T18:00:00+06:00`),
        endsAt: new Date(`${date}T23:00:00+06:00`),
        venueName: venue,
      },
    });
  for (const [i, title, done] of [
    [1, "Find the perfect venue", true],
    [2, "Shortlist wedding photographers", true],
    [3, "Send your wedding invitations", false],
    [4, "Finalize the catering menu", false],
    [5, "Book the bridal makeup artist", false],
    [6, "Choose your floral palette", false],
  ] as const)
    await db.checklistItem.upsert({
      where: { id: `task-${i}` },
      update: {},
      create: {
        id: `task-${i}`,
        eventId: event.id,
        title,
        done,
        dueAt: new Date("2027-01-15T12:00:00+06:00"),
      },
    });
  for (const [category, plannedMinor] of [
    ["Venue", 45000000],
    ["Catering", 40000000],
    ["Decoration", 25000000],
    ["Photography", 15000000],
    ["Attire", 15000000],
    ["Other", 10000000],
  ] as const)
    await db.budgetItem.upsert({
      where: { eventId_category: { eventId: event.id, category } },
      update: {},
      create: { eventId: event.id, category, plannedMinor },
    });
  const guests = [
    "Nusrat Jahan",
    "Tanvir Hasan",
    "Sadia Islam",
    "Arif Rahman",
    "Mehjabin Chowdhury",
    "Fahim Ahmed",
    "Sara Karim",
    "Rafiq Uddin",
  ];
  for (const [i, name] of guests.entries())
    await db.guest.upsert({
      where: { id: `guest-${i}` },
      update: {},
      create: {
        id: `guest-${i}`,
        eventId: event.id,
        name,
        email: `guest${i + 1}@example.com`,
        token: randomBytes(32).toString("hex"),
        rsvpStatus: i < 4 ? "ACCEPTED" : i === 7 ? "DECLINED" : "INVITED",
        partySize: (i % 2) + 1,
        maxPartySize: 2,
        tableLabel: i < 4 ? `Table ${Math.floor(i / 2) + 1}` : undefined,
      },
    });
  const services = await db.vendorService.findMany({
    take: 3,
    orderBy: { id: "asc" },
  });
  await db.package.upsert({
    where: { id: "package-signature" },
    update: {},
    create: {
      id: "package-signature",
      title: "The Signature Celebration",
      description:
        "A beautifully coordinated venue, florals, and photography collection.",
      serviceIds: services.map((s) => s.id),
      discountBps: 800,
    },
  });
  const lastDay = await db.eventDay.findFirstOrThrow({
    where: { eventId: event.id },
    orderBy: { endsAt: "desc" },
  });
  const planner = await db.user.upsert({
    where: { email: "planner@utsab.local" },
    update: {},
    create: {
      email: "planner@utsab.local",
      fullName: "Nadia Hassan",
      passwordHash,
      role: "HOST",
    },
  });
  await db.eventMember.upsert({
    where: { eventId_userId: { eventId: event.id, userId: planner.id } },
    update: {},
    create: {
      eventId: event.id,
      userId: planner.id,
      permission: "EDITOR",
      expiresAt: new Date(+lastDay.endsAt + 86400000),
    },
  });
  for (const [id, label, x, y] of [
    ["seat-family", "Family", 130, 170],
    ["seat-friends", "Friends", 400, 170],
    ["seat-colleagues", "Colleagues", 680, 170],
  ] as const)
    await db.seatTable.upsert({
      where: { id },
      update: {},
      create: {
        id,
        eventId: event.id,
        label,
        capacity: 8,
        shape: id === "seat-colleagues" ? "RECTANGLE" : "ROUND",
        x,
        y,
      },
    });
  for (let i = 0; i < 4; i++) {
    const g = await db.guest.findUnique({ where: { id: `guest-${i}` } });
    if (g && !g.seatingTableId)
      await db.guest.update({
        where: { id: g.id },
        data: {
          seatingTableId: i < 2 ? "seat-family" : "seat-friends",
          tableLabel: i < 2 ? "Family" : "Friends",
          groupName: i < 2 ? "Family" : "Friends",
        },
      });
  }
  const weddingDay = await db.eventDay.findUniqueOrThrow({
    where: { id: "day-wedding" },
  });
  for (const [i, title, owner, duration] of [
    [0, "Venue & floral setup", "Bloom & Beyond", 60],
    [1, "Photography team arrival", "Stories by Light", 30],
    [2, "Guest welcome & seating", "Welcome team", 30],
    [3, "The wedding ceremony", "Celebration coordinator", 45],
    [4, "Dinner service", "Royal Feast", 60],
    [5, "Family photographs", "Stories by Light", 30],
  ] as const)
    await db.runSheetItem.upsert({
      where: { id: `cue-${i}` },
      update: {},
      create: {
        id: `cue-${i}`,
        eventId: event.id,
        dayId: weddingDay.id,
        title,
        owner,
        durationMinutes: duration,
        startsAt: new Date(+weddingDay.startsAt + (i - 2) * 45 * 60000),
        status: i === 0 ? "READY" : "PLANNED",
        location: "The Grand Palace",
      },
    });
  for (const [i, name, stage, value] of [
    [0, "Nusrat & Adnan", "NEW", 350000],
    [1, "Farzana & Imran", "QUALIFIED", 450000],
    [2, "The Rahman reception", "PROPOSAL", 600000],
    [3, "A little anniversary", "WON", 180000],
    [4, "Dhaka Creative Awards", "QUALIFIED", 750000],
    [5, "Winter garden celebration", "LOST", 300000],
  ] as const)
    await db.lead.upsert({
      where: { id: `lead-${i}` },
      update: {},
      create: {
        id: `lead-${i}`,
        vendorId: grand.id,
        name,
        stage,
        estimatedMinor: value * 100,
        email: `inquiry${i + 1}@example.com`,
        notes:
          "Development sample inquiry. Confirm the brief and expected guest count.",
        eventDate: new Date(Date.now() + (40 + i * 12) * 86400000),
        followUpAt: new Date(Date.now() + (i - 1) * 86400000),
      },
    });
  const contractData = {
    eventId: event.id,
    vendorId: grand.id,
    title: "The Grand Palace · celebration agreement",
    body: "Scope: Exclusive use of the signature ballroom for your wedding celebration, including six hours of service and two hours of setup buffer.\n\nResponsibilities: The venue team will prepare the room and coordinate access with your wedding professionals. The host will confirm the final guest count seven days before the celebration.\n\nPayments: A 30% advance confirms your reserved date; the balance follows the agreed milestones.\n\nChanges and cancellations: Contact the venue before making changes. Paid cancellation requests are reviewed by the platform administrator.\n\nThis is a development sample agreement. Review and replace it with your own agreed terms before use.",
    amountMinor: 25000000,
  };
  await db.contract.upsert({
    where: { id: "contract-grand-palace" },
    update: {},
    create: {
      id: "contract-grand-palace",
      ...contractData,
      contentHash: createHash("sha256")
        .update(JSON.stringify(contractData))
        .digest("hex"),
    },
  });
  for (const [id, kind, title, value, tag] of [
    [
      "mood-florals",
      "IMAGE",
      "Soft florals & warm light",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85",
      "The atmosphere",
    ],
    ["mood-rose", "COLOR", "A little dusty rose", "#b97b86", "Our palette"],
    ["mood-sage", "COLOR", "Garden sage", "#899a7d", "Our palette"],
    [
      "mood-note",
      "NOTE",
      "A room that feels like us",
      "Warm candlelight, seasonal flowers, and enough room for our favorite people to dance. Keep the stage intimate and the welcome personal.",
      "The atmosphere",
    ],
  ] as const)
    await db.moodItem.upsert({
      where: { id },
      update: {},
      create: { id, eventId: event.id, kind, title, value, tag },
    });
  for (const v of await db.vendor.findMany({
    where: { slug: { in: ["the-grand-palace", "stories-by-light"] } },
  }))
    await db.favorite.upsert({
      where: { userId_vendorId: { userId: host.id, vendorId: v.id } },
      update: {},
      create: { userId: host.id, vendorId: v.id },
    });
  await db.automationRule.upsert({
    where: { id: "automation-final-check" },
    update: {},
    create: {
      id: "automation-final-check",
      eventId: event.id,
      title: "Our final little check-in",
      trigger: "EVENT_APPROACHING",
      daysBefore: 7,
      action: "CREATE_TASK",
      message:
        "Confirm arrival times and handoffs with every wedding professional.",
      createdBy: host.id,
      enabled: false,
    },
  });
  await db.eventWebsite.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      slug: "ayesha-and-raihan",
      headline: "Ayesha & Raihan — a beautiful beginning",
      story:
        "Some stories begin with a grand gesture. Ours began with a conversation that neither of us wanted to end. We’re bringing our favorite people together to celebrate all the little moments that led us here.",
      coverUrl:
        "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85",
      theme: "ROSE",
      faqs: [
        {
          question: "What should we wear?",
          answer:
            "Bring your favorite festive look and a little room for dancing.",
        },
        {
          question: "How do I RSVP?",
          answer: "Please use the personal invitation link we shared with you.",
        },
      ],
      published: false,
    },
  });
  console.log(
    "Seed ready. Local host/vendor: host@utsab.local / vendor@utsab.local; password: UtsabDemo2027!",
  );
}
seed().finally(() => db.$disconnect());
