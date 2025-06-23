# syntax=docker/dockerfile:1.15-labs

# Build stage:
FROM node:20-alpine AS builder

# Install required packages for customization and git
RUN apk add --no-cache brotli git

# Build-time env variables
ARG SENTRY_DSN
ARG PATH_PREFIX
ARG API_URL
ARG BRANDING_HEADER_TITLE_TEXT
ARG BRANDING_HEADER_TITLE_TEXT_SHORT
ARG BRANDING_FOOTER_GDPR_TEXT
ARG BRANDING_FOOTER_GDPR_LINK
ARG BRANDING_FOOTER_HOME_TEXT
ARG BRANDING_FOOTER_HOME_LINK
ARG BRANDING_LOGIN_PLACEHOLDER_EMAIL

# Customization build-time env variables
ARG ICON_URL
ARG LOGO_URL
ARG ICON_BLACK_URL
ARG CUSTOM_PRIMARY_COLOR
ARG CUSTOM_SECONDARY_COLOR
ARG CUSTOM_RED_COLOR
ARG CUSTOM_GREEN_COLOR
ARG CUSTOM_TEXT_MUTED_COLOR
ARG CUSTOM_SECONDARY_BACKGROUND_COLOR
ARG CUSTOM_SECONDARY_TEXT_COLOR
ARG CUSTOM_FORCE_LINK_UNDERLINE
ARG CUSTOM_LIGHTER_PRIMARY_HOVER
ARG CUSTOM_LIGHTER_SECONDARY_HOVER
ARG CUSTOM_HEADER_LOGO

WORKDIR /opt/ilmomasiina

# Initialize git repository and configure user (required for git operations)
RUN git init && \
    git config user.email "docker@build.local" && \
    git config user.name "Docker Build"

# Copy git configuration and initialize submodule
COPY .gitmodules /opt/ilmomasiina/.gitmodules

# Copy customization scripts and root package files
COPY scripts/ /opt/ilmomasiina/scripts/
COPY package.json pnpm-lock.yaml /opt/ilmomasiina/

# Install customization dependencies and initialize submodules
RUN corepack enable && pnpm install --frozen-lockfile

# Clone the submodule
RUN git submodule add https://github.com/Tietokilta/ilmomasiina.git ilmomasiina && \
    git submodule update --init --recursive

# Install ilmomasiina dependencies (submodule is now available)
RUN cd ilmomasiina && pnpm install --frozen-lockfile

# Run customization process
RUN if [ -n "$ICON_URL" ]; then \
        echo "Running customization process..." && \
        export ICON_URL="$ICON_URL" && \
        export LOGO_URL="$LOGO_URL" && \
        export ICON_BLACK_URL="$ICON_BLACK_URL" && \
        export CUSTOM_PRIMARY_COLOR="$CUSTOM_PRIMARY_COLOR" && \
        export CUSTOM_SECONDARY_COLOR="$CUSTOM_SECONDARY_COLOR" && \
        export CUSTOM_RED_COLOR="$CUSTOM_RED_COLOR" && \
        export CUSTOM_GREEN_COLOR="$CUSTOM_GREEN_COLOR" && \
        export CUSTOM_TEXT_MUTED_COLOR="$CUSTOM_TEXT_MUTED_COLOR" && \
        export CUSTOM_SECONDARY_BACKGROUND_COLOR="$CUSTOM_SECONDARY_BACKGROUND_COLOR" && \
        export CUSTOM_SECONDARY_TEXT_COLOR="$CUSTOM_SECONDARY_TEXT_COLOR" && \
        export CUSTOM_FORCE_LINK_UNDERLINE="$CUSTOM_FORCE_LINK_UNDERLINE" && \
        export CUSTOM_LIGHTER_PRIMARY_HOVER="$CUSTOM_LIGHTER_PRIMARY_HOVER" && \
        export CUSTOM_LIGHTER_SECONDARY_HOVER="$CUSTOM_LIGHTER_SECONDARY_HOVER" && \
        export CUSTOM_HEADER_LOGO="$CUSTOM_HEADER_LOGO" && \
        node scripts/customize.js && \
        echo "Customization completed"; \
    else \
        echo "No ICON_URL provided, skipping customization"; \
    fi

# Replace original files with customized versions if they exist
RUN if [ -f "custom/styles/_definitions.scss" ]; then \
        echo "Replacing _definitions.scss with customized version" && \
        cp custom/styles/_definitions.scss ilmomasiina/packages/ilmomasiina-components/src/styles/_definitions.scss; \
    fi

RUN if [ -d "custom/public" ] && [ "$(ls -A custom/public)" ]; then \
        echo "Replacing public icons with customized versions" && \
        cp custom/public/*.png custom/public/*.ico ilmomasiina/packages/ilmomasiina-frontend/public/ 2>/dev/null || true; \
    fi

# Replace logo.svg if it exists
RUN if [ -f "custom/public/logo.svg" ]; then \
        echo "Replacing logo.svg with customized version" && \
        cp custom/public/logo.svg ilmomasiina/packages/ilmomasiina-frontend/src/assets/logo.svg; \
    fi

# Default to production
ENV NODE_ENV=production

# Build all packages
RUN cd ilmomasiina && npm run build

# precompress static files for frontend
RUN find ilmomasiina/packages/ilmomasiina-frontend/build -type f\
  -regex ".*\.\(js\|json\|html\|map\|css\|svg\|ico\|txt\)" -exec gzip -k "{}" \; -exec brotli "{}" \;

# Main stage:
FROM node:20-alpine

# Accept VERSION at build time, pass to backend server
ARG VERSION
ENV VERSION=$VERSION

# Default to production
ENV NODE_ENV=production

# Listen at 0.0.0.0 when inside Docker
ARG HOST
ENV HOST=$HOST

WORKDIR /opt/ilmomasiina

# Copy package.json files and install production dependencies
COPY --from=builder /opt/ilmomasiina/ilmomasiina/package.json /opt/ilmomasiina/ilmomasiina/package.json
COPY --from=builder /opt/ilmomasiina/ilmomasiina/pnpm-*.yaml /opt/ilmomasiina/ilmomasiina/
COPY --from=builder /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-backend/package.json /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-backend/package.json
COPY --from=builder /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-models/package.json /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-models/package.json

# Install production dependencies
RUN cd ilmomasiina && corepack enable && pnpm install --frozen-lockfile --prod --filter @tietokilta/ilmomasiina-backend --filter @tietokilta/ilmomasiina-models

# Copy compiled ilmomasiina-models from build stage
COPY --from=builder /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-models/dist /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-models/dist

# Copy built backend from build stage
COPY --from=builder /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-backend/dist /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-backend/dist

# Copy built frontend from build stage
COPY --from=builder /opt/ilmomasiina/ilmomasiina/packages/ilmomasiina-frontend/build /opt/ilmomasiina/frontend

# Create user for running
RUN adduser -D -h /opt/ilmomasiina ilmomasiina
USER ilmomasiina

# Start server
CMD ["node", "ilmomasiina/packages/ilmomasiina-backend/dist/bin/server.js"]