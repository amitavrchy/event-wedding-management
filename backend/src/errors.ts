import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
@Catch()
export class ApiErrors implements ExceptionFilter {
  private logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        response.status(409).json({ message: "This record already exists" });
        return;
      }
      if (error.code === "P2025") {
        response.status(404).json({ message: "Record not found" });
        return;
      }
      if (error.code === "P2003") {
        response
          .status(400)
          .json({ message: "Referenced record is unavailable" });
        return;
      }
    }
    this.logger.error(error);
    response.status(500).json({
      message: "The request could not be completed. Please try again.",
    });
  }
}
