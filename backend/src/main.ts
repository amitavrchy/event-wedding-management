import "reflect-metadata";
import "dotenv/config";
import { Module, Controller, Get } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import helmet from "helmet";
import { Database } from "./prisma";
import { AuthController, AuthGuard } from "./auth";
import { EventsController } from "./events";
import { VendorsController } from "./vendors";
import { BookingsController } from "./bookings";
import { BudgetController } from "./budget";
import { GuestsController, RsvpController } from "./guests";
import { PaymentsController } from "./payments";
import { PackagesController, QuotesController } from "./packages";
import { MessagesController } from "./messages";
import { ReviewsController } from "./reviews";
import { AdminController } from "./admin";
import { RateLimit } from "./rate-limit";
import { Jobs } from "./jobs";
import { realtime } from "./realtime";
import { ApiErrors } from "./errors";
import { CartController } from "./cart";
import { NotificationsController } from "./notifications";
import { DisputesController } from "./disputes";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must have at least 32 characters");
@Controller("health")
class HealthController {
  constructor(private db: Database) {}
  @Get() async check() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      paymentMode:
        process.env.PAYMENT_MODE === "sandbox" ? "sandbox" : "unconfigured",
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
  ],
  providers: [
    Database,
    AuthGuard,
    Jobs,
    { provide: APP_GUARD, useClass: RateLimit },
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalFilters(new ApiErrors());
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(
    ",",
  );
  app.enableCors({ origin: origins });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  realtime(
    app.getHttpServer(),
    app.get(Database),
    app.get(JwtService),
    origins,
  );
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
void bootstrap();
