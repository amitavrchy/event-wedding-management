# Mobile/API contract

Audited against `mobile/lib` and `backend/src` on 2026-11-16. Paths below are relative to `/api/`; IDs are path parameters. JSON fields listed are those mobile sends or reads, not necessarily every field the API returns. Amounts are integer paisa; timestamps are ISO 8601. Protected resources require an active session and, where applicable, event/vendor permissions and feature gates.

Mobile registration/login sends `client: mobile` and receives `{user, accessToken, refreshToken}` (or a 2FA challenge). The access token is sent as `Authorization: Bearer …`, not a cookie; refresh rotates both tokens via a JSON `refreshToken`. Authenticated 401s are retried once after a shared refresh; invalid refresh signs out, while network errors retain the session. Tokens are stored in Flutter secure storage under `ayojon.access` and `ayojon.refresh`. The app has never stored token keys in SharedPreferences in this repository; it stores only profile and UI preferences there, so no token migration is needed. Web cookie auth and its CSRF header are separate. Email code verification accepts an optional identity and returns 400 for an expired identity, so mobile checks `auth/me` first to refresh it.

| Method and path | Mobile request | Fields mobile reads / result |
|---|---|---|
| GET `app/config` | query `version`, `platform` | `updateRequired`, `maintenance`, `storeUrl` |
| POST `auth/register` | `fullName`, `email`, `password`, `role`, `locale`, `client`, `deviceName` | tokens and `user` |
| POST `auth/login` | `email`, `password`, `client`, `deviceName` | tokens and `user`, or `twoFactorRequired`, `challenge` |
| POST `auth/login/2fa` | `challenge`, `code` | tokens and `user` |
| POST `auth/refresh`, `auth/logout` | `refreshToken` | refresh: rotated tokens; logout: `ok` |
| GET/PATCH/DELETE `auth/me` | PATCH `locale`; DELETE `password` | profile: `id`, `fullName`, `email`, `role`, `phone`, `locale`, `emailVerified`, `phoneVerified`, `twoFactorEnabled` |
| POST `auth/email/verify`, `auth/password/forgot` | respectively `code`, `email` | verify returns profile; forgot result ignored |
| GET `auth/sessions`, DELETE `auth/sessions/:id` | none | session list: `id`, `client`, `deviceName`, `current`, `lastUsedAt` |
| POST `auth/devices` | `platform` (`ios`/`android`), `token` | `ok` |
| GET `auth/socket-token` | bearer | `{token}` for Socket.IO handshake |
| GET `event-types`, `features` | none | event types: `type`, `label`, `labelBn`, `description`, `budgetMinor`, `guestCapacity`, `features`; catalog: `groups`, `features` with `key`, `group`, `label`, `labelBn`, `description`, `path`, `core` |
| GET/POST `events` | POST `title`, `eventType`, `city`, `budgetMinor`, `guestCapacity`, `starterPlan`, optional `startsAt` | event `id`, `title`, `eventType`, `city`, `budgetMinor`, `guestCapacity`, `features`, `days` |
| GET/PATCH `events/:id` | PATCH `enabledFeatures`, `disabledFeatures` | detail adds `access`, `tasks`, `guests`, `expenses`, `sides`; days: `id`, `name`, `startsAt`, `venueName` |
| POST `events/:id/tasks`; PATCH/DELETE `events/:id/tasks/:taskId` | POST `title`; PATCH `done` | task `id`, `title`, `done`, `dueAt` from event detail |
| POST `events/:id/guests`; PATCH/DELETE `events/:id/guests/:guestId` | `name`, optional `phone`, `relationship`, `side`, `maxPartySize` | guest `id`, `name`, `rsvpStatus`, `partySize`, `maxPartySize`, `phone`, `side`, `token`, `relationship`, `mealPreference` from event detail |
| POST `events/:id/guests/mark-sent` | `guestIds` or `householdIds` | result ignored |
| GET `events/:id/budget` | none | `expenses`, `plannedMinor`, `committedMinor`, `actualMinor`, `alert`; expense `id`, `note`, `category`, `amountMinor`, `paidBy` |
| POST `events/:id/budget/expenses` | `category`, `note`, `amountMinor` | created expense `id` |
| PATCH/DELETE `events/:id/budget/expenses/:expenseId` | PATCH optional `paidBy`, `receiptMediaId` | result ignored |
| GET/POST `events/:id/gifts`; PATCH `events/:id/gifts/:giftId` | POST `giverName`, `kind`, optional `amountMinor`, `description`; PATCH `thankYouSent` | `items` (`id`, `giverName`, `kind`, `amountMinor`, `description`, `thankYouSentAt`), `summary` (`count`, `cashMinor`, `thankYouPending`) |
| GET `events/:id/cost-split` | none | `labels`, `settlement` (`from`, `to`, `amountMinor`), `sharePercent`, `totalMinor`, `paidMinor`, `fairShareMinor` |
| GET `events/:id/catering` | query `buffer` | `overall`, `days`: `name`, `confirmedPeople`, `recommendedPlates`, `meals` |
| GET `events/:id/invitations/share` | query `language` | array `type`, `id`, `name`, `phone`, `text`, `sentAt`, `openedAt` |
| GET `events/:id/check-in/:dayId/roster` | none | `guests`: `token`, `name`, `partySize`, `tableLabel`, `arrivedAt` |
| POST `events/:id/check-in/:dayId`, `.../sync` | `token`; sync `items` of `clientId`, `token` | arrival `duplicate`, `guest` (`name`, `partySize`); sync `results` (`clientId`, `ok`, `error`) |
| GET `events/:id/photo-wall`; POST `.../settings`; PATCH `.../:photoId` | query `status`; settings `enabled`, `moderation`; PATCH `status` | `token`, `uploadUrl`, `photos` (`id`, `url`) |
| GET `events/:id/run-sheet`; PATCH `.../:itemId` | PATCH `status`, `version` | array `id`, `title`, `startsAt`, `owner`, `durationMinutes`, `status`, `version` |
| GET `vendors` | query `page`, `limit`, optional `q`, `guests`, `startAt` | page `items`, `total`; vendor `id`, `slug`, `businessName`, `category`, `city`, `description`, `image`, `services`, `verified`, `sponsored`, `ratingAvg`, `ratingCount`, `priceFromMinor`, `responseMinutes` |
| GET `vendors/:id` | none | `services` (`id`, `title`) for quote acceptance |
| GET `vendors/mine`, `vendors/:id/inquiries`, `vendors/:id/report` | inquiries query `limit` | businesses `id`, `businessName`, `gallery`, `planCode`; inquiries `items` (`name`, `status`, `eventDate`, `guestCount`, `budgetMinor`, `message`, `conversationId`, `phone`); report `month`, `inquiries`, `responseRate`, `bookings`, `bookedValueMinor`, `averageResponseMinutes` |
| POST `vendors/:id/inquiries`; PATCH `vendors/:id` | inquiry optional `eventId`, `eventDate`, `guestCount`, `phone`, required `message`; PATCH `gallery` (existing URLs and new media IDs) | result ignored |
| GET `bookings`; POST `bookings/:id/confirm`, `bookings/:id/offline-payments` | payment `amountMinor`, `method`, `idempotencyKey` | bookings `id`, `service.title`, `service.vendor.businessName`, `startAt`, `priceMinor`, `status` |
| GET `quotes/event/:id`; POST `quotes/:id/respond` | reject `status`; accept `status`, `serviceId`, `startAt` | quote `id`, `vendorId`, `status`, `amountMinor`, `expiresAt` |
| POST `uploads`; PUT/POST returned upload URL; POST `uploads/:id/complete` | slot `purpose`, `contentType`, `sizeBytes`, optional `fileName`; upload bytes and optional returned form fields | slot `id`, `upload.method`, `upload.url`, `upload.fields`; completed media `id` |
| GET `conversations`, `conversations/:id/messages`; POST `conversations/:id/messages` | POST `body` | conversations `id`, `eventTitle`, `vendorName`, `lastMessage.body`; messages `id`, `conversationId`, `senderId`, `body`, `createdAt` |
| GET `notifications`; PATCH `notifications/:id/read` | none | notification `id`, `read`, `title`, `body`, `link` |

## Socket.IO

The app connects to the root namespace using WebSocket transport and handshake `auth: {token}` from `GET auth/socket-token`; the server also accepts a valid mobile access token. Both require an active session. Chat emits `join` with a conversation ID and receives an acknowledgement `{ok: true}` or `{error}`; it listens for server `message` objects in the same shape as HTTP messages, and emits `leave` with the ID on disposal. It rejoins and reloads on every connection. Messages are sent over HTTP, whose server handler broadcasts the same `message` event. The server additionally supports client `message` (`conversationId`, `body`) with an acknowledgement and publishes `booking:update` and notification events to user rooms; mobile does not currently consume those events.
