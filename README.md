# Guitar Tuner

A guitar tuner built with React Native (Expo) that runs as an **iPhone app** and as a **web app** from the same code. There is no backend — pitch detection runs entirely on the device.

## Project layout

| Path | What it is |
| --- | --- |
| `App.tsx` | The tuner screen |
| `src/pitch.ts` | Pitch detection (McLeod Pitch Method), pure TypeScript, shared by all platforms |
| `src/useTuner.ts` | Note tracking: locks onto a pluck, follows it as it rings out, holds the last reading |
| `src/music.ts` | Tunings and note math |
| `src/Gauge.tsx` | Needle gauge (react-native-svg) |
| `src/audio.ts` | iPhone/Android microphone and reference tones via `react-native-audio-api` |
| `src/audio.web.ts` | Browser microphone (`getUserMedia`) and reference tones via Web Audio |
| `server.js` | Optional static HTTPS server to share the web build on your local network |

## iPhone app

Requires **Xcode** (free, Mac App Store). The app uses native audio code, so it runs as a development build, not in Expo Go.

```bash
npm run ios          # build and launch in the iOS Simulator
npm run ios:device   # build and install on an iPhone connected by USB
npm run ios:release  # standalone Release build on the iPhone — no Mac or dev server needed
```

For a physical iPhone, the first run asks you to pick a signing team in Xcode — your Apple ID works (free accounts: the app must be reinstalled every 7 days; a paid Apple Developer account removes that limit). On the iPhone, enable **Settings → Privacy & Security → Developer Mode** and trust your developer profile under **Settings → General → VPN & Device Management**.

## Web app

```bash
npm run web          # development server at http://localhost:8081
npm run build:web    # static build in dist/ — host it anywhere with HTTPS
```

### Share the web version on your local network

```bash
npm run serve:web
```

Builds the web app and serves `dist/` at https://tuner.local (Bonjour/mDNS on macOS) and your LAN IP, with plain HTTP redirected to HTTPS. Browsers only allow the microphone on secure origins, so it creates a local certificate authority and server certificate in `certs/` (git-ignored — it contains private keys).

- **Host computer:** use http://localhost — no warning.
- **Other devices:** the first visit shows a certificate warning — tap **Advanced → Proceed**.
- **iPhone/iPad Safari:** install the certificate from `http://tuner.local/ca.crt`, then enable it in **Settings → General → About → Certificate Trust Settings**.

Ports: HTTPS 443 (falls back to 8443), HTTP 80 (falls back to 8080); override with `HTTPS_PORT` / `PORT`.

## Features

- Auto string detection or manual string selection
- Needle gauge with a ±5 cent in-tune zone; strings turn green once tuned
- Tunings: Standard, Drop D, Half step down, Full step down, Drop C, Open G, Open D, DADGAD
- Adjustable A4 reference (415–466 Hz) and reference tones per string
