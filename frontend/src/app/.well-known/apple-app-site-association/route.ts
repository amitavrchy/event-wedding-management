/** iOS Universal Links. Set IOS_APP_ID as "<TEAMID>.com.ayojon.ayojon". */
export const dynamic = "force-dynamic";
export function GET() {
  const appId = process.env.IOS_APP_ID;
  return Response.json({
    applinks: {
      details: appId
        ? [{ appIDs: [appId], components: [{ "/": "/invite/*" }, { "/": "/rsvp/*" }, { "/": "/messages*" }, { "/": "/bookings*" }] }]
        : [],
    },
  });
}
