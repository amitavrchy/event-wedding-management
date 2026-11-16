# Utsab QA final report — 2026-11-16

This report closes out the findings recorded in [the original audit](qa-audit-2026-11-16.md), whose evidence refers to checkout `b62d677`. It describes branch `qa/release-readiness-2026-11-16` through code commit `a131094`. The original audit was partial; this report is not a comprehensive security review or approval for commercial launch.

## Original findings

| ID | Disposition | Evidence and qualification |
| --- | --- | --- |
| QA-01 | Remaining | `d19a7f8` adds release keystore configuration, code and resource shrinking, but falls back to debug signing when `android/key.properties` is absent. The recorded APK and AAB used debug signing; a protected production signing key and verified Play signing identity remain necessary. Do not publish debug-signed artifacts. |
| QA-02 | Fixed (`0da892a`) | Quote acceptance requires a service and date and creates a booking and offline installments transactionally, handles reservation conflicts and repeat acceptance, and notifies both parties. Previously accepted quotes without bookings still require operational review; the new flow does not backfill them. |
| QA-03 | Fixed (`d19a7f8`) | Release defaults and the release configuration use HTTPS API, web and socket endpoints. The current `sslip.io` host still needs replacement with an owned production domain. |
| QA-04 | Fixed (`2dfcc94`) | Adds a Podfile and app privacy manifest. The declaration, third-party SDK manifests and required-reason APIs still need App Store and legal review; signing and Apple team configuration remain external. |
| QA-05 | Fixed (`e261a18`, `4a83396`, `a131094`) | Configurable browser base URL, a test-server auth limit, save synchronization and quote/guestbook test stabilization address the observed problems. The original GitHub failure artifact was not inspected, so its cause was not established. |
| QA-06 | Fixed (`c947a39`) | Public English/Bangla locale selection updates the document language and public content. |
| QA-07 | Fixed (`d19a7f8`) | Replaces Flutter launcher icons and the default mobile README. A final Utsab versus Ayojon brand decision remains. |
| QA-08 | Fixed (`4a83396`) | CI runs Flutter dependency installation, analysis, tests and a debug Android build. |
| QA-09 | Fixed (`2cb31ff`, `430aa5b`, `a540fc9`) | Transient refresh errors retain the session; rejected refresh or retry expires it, with mobile auth and contract coverage. |

## Branch work and commits

All commits in `git log main..a131094` are listed below, newest first:

- `a131094` — stabilize quote and guestbook browser flows.
- `d789dde` — add confirmations to destructive workspace actions.
- `c947a39` — add shared English/Bangla public locale and language switching.
- `a540fc9` — audit and fix mobile API authentication, socket and quote contracts; document and test them.
- `0da892a` — complete the quotation-to-booking loop and offline installments.
- `8dc661e` — record round-two partial verification and outstanding work.
- `1954772` — configure Android asset links and iOS app associations from deployment identities and test them.
- `e7ddc9e` — record the partial QA audit and release blockers.
- `e0cf654` — ignore local Kotlin compiler session files.
- `2dfcc94` — add iOS release metadata, Podfile and privacy manifest.
- `d19a7f8` — add Android signing and shrinking configuration, production endpoints, release script and app icons.
- `430aa5b` — expire mobile sessions rejected after refresh.
- `4a83396` — add Flutter CI and isolate browser-test authentication limits.
- `2cb31ff` — preserve mobile sessions on transient refresh failures.
- `e261a18` — make the browser base URL configurable and wait for checklist persistence before reload.

## Verification

- [PR #4](https://github.com/amitavrchy/event-wedding-management/pull/4), head `a131094`: GitHub [product-checks](https://github.com/amitavrchy/event-wedding-management/actions/runs/43813804063/job/133121157084) and [flutter](https://github.com/amitavrchy/event-wedding-management/actions/runs/43813804063/job/133121157405) succeeded. Product checks include backend tests and build, frontend build, both npm audits and 24 browser tests; Flutter includes analyze, test and a debug APK build. Both CI npm audits reported zero vulnerabilities.
- The original audit records successful local backend build and tests (43 tests), frontend build, and backend and frontend npm audits with zero vulnerabilities at the earlier round-two checkpoint. These local results predate the later marketplace, mobile, locale and browser changes; the current code is covered by the CI run above.
- The original audit records local `flutter analyze`, `flutter test` and an iOS release build with `--no-codesign` passing at the earlier checkpoint. They predate `a540fc9`; the later mobile code was checked by the green Flutter CI job, which does not build iOS.
- The original audit records release APK and AAB builds using debug fallback signing before the later mobile contract changes. The locally available AAB identifies its signer as `Android Debug`; these are signed build artifacts, not verified production-signed distribution artifacts. A current production-key-signed APK/AAB and current iOS release build are not evidenced by the available records.
- The earlier local browser run passed 20/20 once and subsequently had one guestbook timeout; `a131094` addresses browser-flow stability and the later CI run passed 24/24. The earlier audit records scratch database cleanup and stopped servers.

## Remaining external and operational work

- Replace the IP-derived `sslip.io` domain with an owned domain, provision TLS and update deployment, app endpoints and association hosts. Configure actual Android package and Play signing certificate fingerprints and the Apple team and bundle identifiers.
- Set up Play Console and App Store accounts, protected Android signing material and Apple signing; perform store submission and privacy review. Verify distribution builds with their actual identities.
- Configure Firebase project, platform files and production push credentials if push is required; it is currently optional and unconfigured.
- Provision and verify production SMS, email and object-storage credentials and delivery, independently of sandbox and development configuration.
- Obtain legal review of terms, privacy disclosures and app privacy manifest, and settle the legal company name.
- Configure and exercise off-host backups and restore drills, monitoring and alerts, and a staging environment. Backup and restore scripts exist; production operation has not been verified here.
- Complete and formally close the security incident, including any required credential rotation and review.
- Decide the Utsab versus Ayojon brand and align customer-facing names, app identifiers and assets as appropriate.
- Recruit and validate sufficient vendor supply for the intended launch markets; verify real marketplace availability and operations.
- Complete any outstanding full security review, device and staging acceptance, and operational deployment verification before launch. Track the Firebase Kotlin Gradle plugin compatibility warning and verify CocoaPods/Swift Package Manager integration for iOS distribution.
