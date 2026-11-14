/** Android App Links: lets ayojon:// web links open the app. Set ANDROID_CERT_SHA256 (comma separated). */
export const dynamic = "force-dynamic";
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((f) => f.trim()).filter(Boolean);
  return Response.json(
    fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: process.env.ANDROID_PACKAGE || "com.ayojon.ayojon", sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [],
  );
}
