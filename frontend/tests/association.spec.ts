import { test, expect } from "@playwright/test";
import { GET as android } from "../src/app/.well-known/assetlinks.json/route";
import { GET as apple } from "../src/app/.well-known/apple-app-site-association/route";

test("association files use the configured app identities", async () => {
  const keys = ["ANDROID_PACKAGE", "ANDROID_CERT_SHA256", "IOS_TEAM_ID", "IOS_BUNDLE_ID"] as const;
  const old = keys.map((key) => process.env[key]);
  try {
    process.env.ANDROID_PACKAGE = "example.app";
    process.env.ANDROID_CERT_SHA256 = " upload , play ,, ";
    process.env.IOS_TEAM_ID = "TEAM";
    process.env.IOS_BUNDLE_ID = "example.app";
    expect((await android().json())[0].target).toEqual({ namespace: "android_app", package_name: "example.app", sha256_cert_fingerprints: ["upload", "play"] });
    expect((await apple().json()).applinks.details[0].appIDs).toEqual(["TEAM.example.app"]);
    delete process.env.ANDROID_PACKAGE;
    delete process.env.IOS_TEAM_ID;
    expect(await android().json()).toEqual([]);
    expect((await apple().json()).applinks.details).toEqual([]);
  } finally {
    keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; });
  }
});
