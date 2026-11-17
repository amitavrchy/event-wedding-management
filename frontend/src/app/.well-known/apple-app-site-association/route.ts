/** iOS Universal Links are enabled only when both identity values are configured. */
export const dynamic = "force-dynamic";
export function GET() {
  const teamId = process.env.IOS_TEAM_ID?.trim();
  const bundleId = process.env.IOS_BUNDLE_ID?.trim();
  const appId = teamId && bundleId ? `${teamId}.${bundleId}` : undefined;
  return Response.json({
    applinks: {
      details: appId
        ? [{ appIDs: [appId], components: [{ "/": "/invite/*" }, { "/": "/rsvp/*" }, { "/": "/messages*" }, { "/": "/bookings*" }] }]
        : [],
    },
  });
}
