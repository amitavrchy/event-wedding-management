import { Controller, Get, Query } from "@nestjs/common";

const versionValue = (v: string) =>
  v
    .split(/[.+]/)
    .slice(0, 3)
    .map((n) => Number(n) || 0)
    .reduce((acc, n) => acc * 1000 + n, 0);

/**
 * Mobile app configuration. Installed apps cannot be updated by a deploy, so
 * the app checks this on start: below MIN version it must update; the API can
 * also announce maintenance.
 */
@Controller("app")
export class AppConfigController {
  @Get("config") config(@Query("version") version?: string, @Query("platform") platform?: string) {
    const min = process.env.MOBILE_MIN_VERSION || "1.0.0";
    const latest = process.env.MOBILE_LATEST_VERSION || min;
    return {
      minVersion: min,
      latestVersion: latest,
      updateRequired: version ? versionValue(version) < versionValue(min) : false,
      updateAvailable: version ? versionValue(version) < versionValue(latest) : false,
      maintenance: process.env.MAINTENANCE_MESSAGE || null,
      storeUrl:
        platform === "ios"
          ? process.env.APP_STORE_URL || null
          : process.env.PLAY_STORE_URL || null,
      webUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
      supportPhone: process.env.SUPPORT_PHONE || null,
    };
  }
}
