import "reflect-metadata";
import "dotenv/config";
import { Module, Controller, Get } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import helmet from "helmet";
import { Database } from "./prisma";
import { paymentMode } from "./config";
import { AuthController, AuthGuard } from "./auth";
import { EventsController } from "./events";
import { VendorsController } from "./vendors";
import { BookingsController } from "./bookings";
import { BudgetController } from "./budget";
import { GuestsController, HouseholdsController, RsvpController } from "./guests";
import { PaymentsController } from "./payments";
import { PackagesController, QuotesController } from "./packages";
import { MessagesController } from "./messages";
import { ReviewsController } from "./reviews";
import { AdminController } from "./admin";
import { RateLimit } from "./rate-limit";
import { Sessions } from "./security/sessions";
import { Notifier } from "./notify/notifier";
import { DeliveryQueue } from "./notify/queue";
import { Jobs } from "./jobs";
import { realtime } from "./realtime";
import { ApiErrors } from "./errors";
import { CartController } from "./cart";
import { NotificationsController } from "./notifications";
import { DisputesController } from "./disputes";
import { CollaborationController } from "./collaboration";
import { SeatingController } from "./seating";
import { RunSheetController } from "./run-sheet";
import { CheckInController } from "./check-in";
import { ContractsController } from "./contracts";
import { InvoicesController } from "./invoices";
import { CrmController } from "./crm";
import { AutomationsController } from "./automations";
import { WebsitesController, PublicWebsitesController } from "./websites";
import { InspirationController, FavoritesController } from "./inspiration";
import { AnalyticsController } from "./analytics";
import { CategoriesController } from "./categories";
import { AvailabilityController } from "./availability";
import { RecommendationsController } from "./recommendations";
import { EventTypesController, FeaturesController } from "./event-types";
import { UploadsController } from "./storage";
import { PlansController, SubscriptionsController } from "./subscriptions";
import { InquiriesController, VerificationController } from "./marketplace";
import { OccasionController } from "./occasion";
import {
  InvitationsController,
  LogisticsController,
  PhotoWallController,
  PublicPhotoWallController,
} from "./guest-experience";
import { PublicDayOfController, VendorLinksController, VendorReportController } from "./day-of";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must have at least 32 characters");
if (process.env.NODE_ENV === "production" && process.env.PAYMENT_MODE === "sandbox")
  console.warn("PAYMENT_MODE=sandbox is ignored in production; payments are disabled.");
@Controller("health")
class HealthController {
  constructor(
    private db: Database,
    private jobs: Jobs,
  ) {}
  @Get() async check() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      paymentMode: paymentMode(),
      jobs: await this.jobs.status(),
    };
  }
}
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "8h" },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    EventsController,
    VendorsController,
    BookingsController,
    BudgetController,
    GuestsController,
    RsvpController,
    PaymentsController,
    PackagesController,
    QuotesController,
    MessagesController,
    ReviewsController,
    AdminController,
    CartController,
    NotificationsController,
    DisputesController,
    CollaborationController,
    SeatingController,
    RunSheetController,
    CheckInController,
    ContractsController,
    InvoicesController,
    CrmController,
    AutomationsController,
    WebsitesController,
    PublicWebsitesController,
    InspirationController,
    FavoritesController,
    AnalyticsController,
    CategoriesController,
    AvailabilityController,
    RecommendationsController,
    EventTypesController,
    FeaturesController,
    UploadsController,
    PlansController,
    SubscriptionsController,
    VerificationController,
    InquiriesController,
    HouseholdsController,
    OccasionController,
    LogisticsController,
    InvitationsController,
    PhotoWallController,
    PublicPhotoWallController,
    VendorLinksController,
    PublicDayOfController,
    VendorReportController,
  ],
  providers: [
    Database,
    AuthGuard,
    Sessions,
    Notifier,
    DeliveryQueue,
    Jobs,
    { provide: APP_GUARD, useClass: RateLimit },
  ],
})
export class AppModule {}
export async function createApp(options: { logger?: false } = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, options);
  // Behind a reverse proxy (Nginx / the Next.js /api rewrite) set TRUST_PROXY
  // (e.g. "loopback,linklocal,uniquelocal") so req.ip is the real client IP for rate limiting.
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.useGlobalFilters(new ApiErrors());
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  realtime(app.getHttpServer(), app.get(Database), app.get(JwtService), origins);
  return app;
}
async function bootstrap() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
if (require.main === module) void bootstrap();
