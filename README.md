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

Mobile incident management app for AWS CloudWatch alarms. Like PagerDuty/OpsGenie, but with Fallout Pip-Boy aesthetics.

## Stack

- **Mobile**: Tauri v2 + React + TypeScript + Tailwind CSS v4
- **Backend**: AWS CDK (API Gateway + Lambda + DynamoDB + Cognito)

## Features

- View and acknowledge incidents
- Multi-backend configuration, deploy your own AWS environments
- CRT visual effects (scanlines, glow, vignette)
- Pull-to-refresh, swipe navigation
- Push notifications
- Game mode

## TODO

- [_] On-call schedules
- [_] Teams

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
