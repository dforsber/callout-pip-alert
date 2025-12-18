# Callout Fault-Tec

```
██████╗ ██╗██████╗        █████╗ ██╗     ███████╗██████╗ ████████╗
██╔══██╗██║██╔══██╗      ██╔══██╗██║     ██╔════╝██╔══██╗╚══██╔══╝
██████╔╝██║██████╔╝█████╗███████║██║     █████╗  ██████╔╝   ██║
██╔═══╝ ██║██╔═══╝ ╚════╝██╔══██║██║     ██╔══╝  ██╔══██╗   ██║
██║     ██║██║           ██║  ██║███████╗███████╗██║  ██║   ██║
╚═╝     ╚═╝╚═╝           ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝   ╚═╝

> FAULT-TEC APPROVED INCIDENT RESPONSE SYSTEM
```

Mobile incident management app for AWS CloudWatch alarms through SNS with Fallout Pip-Boy aesthetics (directly or through EventBridge forwards).

[![Watch the demo](https://img.youtube.com/vi/dR2mUeVCI5k/0.jpg)](https://youtube.com/shorts/dR2mUeVCI5k)

## Stack

- **Mobile**: Tauri v2 + React + TypeScript + Tailwind CSS v4
- **Backend**: AWS CDK (API Gateway + Lambda + DynamoDB + Cognito)

## Features

- View and acknowledge incidents (alarms must resolve themselves)
- Multi-backend configuration, deploy into your own AWS environments
- CRT visual effects (scanlines, glow, vignette)
- Pull-to-refresh (or via push notifications), swipe navigation
- Local demo, cloud demo, and Game modes

## RoadMap

See also [CHANGELOG.md](CHANGELOG.md)

- [x] Apple iOS TestFlight public link: https://testflight.apple.com/join/qZp5J4QR

### v0.2.0

- [_] Cloud backend selection
- [_] Apple Store publication

### vX.Y.Z

- [_] Android Marketplace
- [_] On-call schedules
- [_] Teams management
- [_] Your feature request?
- [_] Desktop client builds and publish

## Development

```bash
pnpm install
pnpm dev              # Browser dev server
pnpm tauri:dev        # iOS simulator
pnpm tauri:build      # Production build
```

## Project Structure

```
apps/
  mobile/             # Tauri + React mobile app
  backend/            # AWS CDK infrastructure
```

## License

MIT
