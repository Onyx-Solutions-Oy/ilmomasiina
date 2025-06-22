# Ilmomasiina Customizer

This repository provides a customization layer for [Ilmomasiina](https://github.com/Tietokilta/ilmomasiina) that allows you to customize colors and icons through environment variables. The original Ilmomasiina repository is included as a git submodule.

## Features

- **Custom Colors**: Customize primary, secondary, and accent colors
- **Custom Icons**: Replace favicons and app icons with your own
- **Environment-based Configuration**: All customizations are controlled through environment variables
- **Production-ready Docker Build**: Includes optimized Dockerfile for production deployment
- **Easy Testing**: Docker Compose setup for local testing

## Quick Start

1. **Clone this repository**:

   ```bash
   git clone https://github.com/Onyx-Solutions-Oy/ilmomasiina
   cd ilmomasiina
   ```

2. **Initialize the submodule**:

   ```bash
   git submodule update --init --recursive
   ```

3. **Copy and customize the environment file**:

   ```bash
   cp .env.example .env
   # Edit .env with your customizations
   ```

4. **Run the customization**:

   ```bash
   ./scripts/customize.sh
   ```

5. **Test with Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

## Customization Options

### Required Variables

- `ICON_URL`: URL to your main icon image (minimum 512x512 recommended)

### Optional Variables

#### Icons

- `ICON_BLACK_URL`: URL to black/dark variant of your icon

- `LOGO_URL`: URL to your logo for the header

#### Colors

- `CUSTOM_PRIMARY_COLOR`: Primary color (default: #0a0d10)
- `CUSTOM_SECONDARY_COLOR`: Secondary color (default: #0a0d10)
- `CUSTOM_RED_COLOR`: Red/danger color (default: #d74949)
- `CUSTOM_GREEN_COLOR`: Green/success color (default: #319236)
- `CUSTOM_TEXT_MUTED_COLOR`: Muted text color (default: #888)
- `CUSTOM_SECONDARY_BACKGROUND_COLOR`: Secondary background color (default: #f1f1f1)
- `CUSTOM_SECONDARY_TEXT_COLOR`: Secondary text color (default: #7a7a7a)

#### Advanced Settings

- `CUSTOM_FORCE_LINK_UNDERLINE`: Force underlines on links (default: true)
- `CUSTOM_LIGHTER_PRIMARY_HOVER`: Use lighter hover colors for primary buttons (default: true)
- `CUSTOM_LIGHTER_SECONDARY_HOVER`: Use lighter hover colors for secondary buttons (default: true)
- `CUSTOM_HEADER_LOGO`: Show header logo (default: true)

## Production Deployment

### Building the Docker Image

```bash
# Build with customizations
docker build \
  --build-arg ICON_URL="https://example.com/icon.png" \
  --build-arg CUSTOM_PRIMARY_COLOR="#ff6b35" \
  --build-arg CUSTOM_SECONDARY_COLOR="#004e89" \
  -t my-ilmomasiina:latest .
```

### Using Docker Compose

1. Set your environment variables in `.env`
2. Run: `docker compose up -d`

### Environment Variables for Production

Make sure to set secure values for:

- `NEW_EDIT_TOKEN_SECRET`
- `FEATHERS_AUTH_SECRET`
- `EDIT_TOKEN_SALT`

Generate secure secrets with:

```bash
openssl rand -hex 32
```

## Development

### Prerequisites

- Docker and Docker Compose
- pnpm

### Updating Ilmomasiina

To update to a newer version of Ilmomasiina:

```bash
cd ilmomasiina
git fetch origin
git checkout <new-version-tag>
cd ..
git add ilmomasiina
git commit -m "Update Ilmomasiina to <new-version>"
```

## License

This customizer follows the same license as the original Ilmomasiina project.
