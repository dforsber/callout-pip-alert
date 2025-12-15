# CALLOUT RIFF-BOY

```
> VAULT-TEC APPROVED INCIDENT RESPONSE SYSTEM
> INITIALIZING...
```

Mobile incident management app for AWS CloudWatch alarms. Like PagerDuty/OpsGenie, but with Fallout Pip-Boy aesthetics.

## Stack

- **Mobile**: Tauri v2 + React + TypeScript + Tailwind CSS v4
- **Backend**: AWS CDK (API Gateway + Lambda + DynamoDB + Cognito)

## Features

- View, acknowledge, and resolve incidents
- Multi-backend configuration (switch between AWS environments)
- Biometric authentication (Face ID / Touch ID)
- CRT visual effects (scanlines, glow, vignette)
- Pull-to-refresh, swipe navigation

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
