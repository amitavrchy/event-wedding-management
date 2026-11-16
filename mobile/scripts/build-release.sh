#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
flutter build apk --release --dart-define-from-file=config/production.json -PappLinkHost=utsab.13.203.3.1.sslip.io
flutter build appbundle --release --dart-define-from-file=config/production.json -PappLinkHost=utsab.13.203.3.1.sslip.io
