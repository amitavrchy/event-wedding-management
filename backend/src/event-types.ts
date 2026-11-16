import { Controller, Get } from "@nestjs/common";
import { eventTemplates } from "./event-templates";
import { featureCatalog, featureGroups, occasionDefaults } from "./features";
@Controller("event-types")
export class EventTypesController {
  @Get() list() {
    return eventTemplates.map((template) => ({
      ...template,
      features: occasionDefaults[template.type],
    }));
  }
}
@Controller("features")
export class FeaturesController {
  /** Catalogue of workspace tools, their groups and the defaults for each occasion. */
  @Get() catalog() {
    return { groups: featureGroups, features: featureCatalog, occasionDefaults };
  }
}
