/** Android App Links are enabled only when the deployment supplies its identity. */
export const dynamic = "force-dynamic";
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE?.trim();
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((f) => f.trim()).filter(Boolean);
  return Response.json(
    packageName && fingerprints.length
      ? [{
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
        }]
      : [],
  );
}
