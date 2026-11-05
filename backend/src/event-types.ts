import { Controller, Get } from "@nestjs/common";
import { eventTemplates } from "./event-templates";
@Controller("event-types")
export class EventTypesController {
  @Get() list() {
    return eventTemplates;
  }
}
