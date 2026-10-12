# Cafe Flow Native Android MVP

Standalone native Android project built with Kotlin + Jetpack Compose. This folder is isolated from the existing web app.

## Open/build
1. Open Android Studio.
2. Choose **Open** and select the `native-android` folder.
3. Allow Gradle sync to finish (JDK 17 recommended).
4. Select the app configuration and run on an emulator/device.

No GitHub Actions are used. This MVP intentionally does not connect to any Supabase project yet because the repository config ID (`rvaemgwtdvncfvaerhgr`) differs from the connected Cafe Flow project ID (`dbazoxwhhljpgtbnletc`). No production data is written.

## MVP scope
- Native Compose UI for cashier/cart, stock list, QR ordering placeholder, reports, login form, printer settings placeholder.
- Cashier interactions and sample transactions are local in-memory demo data only.
- Login is a UI prototype, not real Supabase Auth.
- QR ordering is a screen placeholder, not a generated/scannable customer QR flow.
- Printer screen is a placeholder; Bluetooth discovery/ESC-POS printing requires implementation and physical printer testing.
- No persistent storage or backend writes yet.
