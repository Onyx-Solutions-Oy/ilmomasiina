#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
require("dotenv").config();

// Colors for console output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

// Utility functions for colored output
const printStatus = (message) =>
  console.log(`${colors.green}[INFO]${colors.reset} ${message}`);
const printWarning = (message) =>
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
const printError = (message) =>
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
const printHeader = (message) =>
  console.log(`${colors.blue}[HEADER]${colors.reset} ${message}`);

// Validation functions
const validateHexColor = (color, name) => {
  const hexPattern = /^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(color)) {
    printError(
      `Invalid hex color format for ${name}: ${color} (expected format: #RGB or #RRGGBB)`
    );
    return false;
  }
  return true;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return ["true", "yes", "1", "on"].includes(lower);
  }
  return true; // default
};

// Directory setup
const setupDirectories = async () => {
  printStatus("Setting up directory structure...");

  const dirs = ["custom", "custom/public", "custom/styles"];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
      printStatus(`Directory already exists: ${dir}`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      printStatus(`Created directory: ${dir}`);
    }
  }
};

// Cleanup function
const cleanPrevious = async () => {
  printStatus("Cleaning previous customizations...");

  try {
    const publicDir = "custom/public";
    const files = await fs.readdir(publicDir);
    for (const file of files) {
      if (
        file.endsWith(".png") ||
        file.endsWith(".ico") ||
        file.endsWith(".svg")
      ) {
        await fs.unlink(path.join(publicDir, file));
      }
    }
  } catch (error) {
    // Directory might not exist, that's okay
  }

  try {
    await fs.unlink("custom/styles/_definitions.scss");
  } catch (error) {
    // File might not exist, that's okay
  }

  printStatus("Previous customizations cleaned");
};

// Icon generation functions
const downloadImage = async (url, outputPath, description) => {
  if (!url) {
    printWarning(`No URL provided for ${description}, skipping...`);
    return false;
  }

  printStatus(`Downloading ${description} from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);

    // Validate it's a valid image using sharp
    await sharp(outputPath).metadata();
    printStatus(`Successfully downloaded and validated ${description}`);
    return true;
  } catch (error) {
    printError(
      `Failed to download ${description} from ${url}: ${error.message}`
    );
    try {
      await fs.unlink(outputPath);
    } catch {}
    return false;
  }
};

const generateFavicon = async (sourceImage, outputFile, size, description) => {
  printStatus(`Generating ${description} (${size}x${size})`);

  await sharp(sourceImage)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFile);
};

const generateAppleTouchIcon = async (sourceImage, outputFile) => {
  printStatus("Generating Apple Touch Icon (180x180)");

  await sharp(sourceImage)
    .resize(180, 180, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFile);
};

const generateFaviconIco = async (sourceImage, outputFile) => {
  printStatus("Generating favicon.ico with multiple sizes");

  // Generate 32x32 as the main favicon.ico (most common size)
  await sharp(sourceImage)
    .resize(32, 32, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFile.replace(".ico", ".png"));

  // For now, we'll generate a PNG instead of ICO since sharp doesn't support ICO
  // Most modern browsers support PNG favicons
  printWarning("Generated favicon as PNG (favicon.ico -> favicon-32x32.png)");
};

const generateSvgLogo = async (sourceImage, outputFile) => {
  printStatus("Generating SVG logo");

  // First, convert to PNG with high resolution to maintain quality
  const pngBuffer = await sharp(sourceImage)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Convert the PNG to base64 for embedding in SVG
  const base64Image = pngBuffer.toString("base64");

  // Create SVG with embedded PNG
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="512" height="512" viewBox="0 0 512 512">
  <image width="512" height="512" xlink:href="data:image/png;base64,${base64Image}"/>
</svg>`;

  await fs.writeFile(outputFile, svgContent);
  printStatus(`SVG logo generated successfully at: ${outputFile}`);
};

const generateIcons = async () => {
  printHeader("Generating custom icons...");

  const outputDir = "custom/public";
  await fs.mkdir(outputDir, { recursive: true });

  const iconUrl = process.env.ICON_URL;
  const logoUrl = process.env.LOGO_URL;
  const iconBlackUrl = process.env.ICON_BLACK_URL;

  if (!iconUrl) {
    printError("ICON_URL environment variable is required");
    process.exit(1);
  }

  // Download main icon
  const mainIcon = path.join(outputDir, "main_icon_temp.png");
  if (!(await downloadImage(iconUrl, mainIcon, "main icon"))) {
    process.exit(1);
  }

  // Download black icon (optional)
  let blackIcon = null;
  if (iconBlackUrl) {
    blackIcon = path.join(outputDir, "black_icon_temp.png");
    await downloadImage(iconBlackUrl, blackIcon, "black icon");
  }

  try {
    // Generate standard favicons from main icon
    await generateFavicon(
      mainIcon,
      path.join(outputDir, "favicon-16x16.png"),
      16,
      "16x16 favicon"
    );
    await generateFavicon(
      mainIcon,
      path.join(outputDir, "favicon-32x32.png"),
      32,
      "32x32 favicon"
    );

    // Generate dark variants
    const darkSource =
      blackIcon &&
      (await fs
        .access(blackIcon)
        .then(() => true)
        .catch(() => false))
        ? blackIcon
        : mainIcon;
    if (!blackIcon) {
      printWarning(
        "No black icon available, using main icon for dark variants"
      );
    }

    await generateFavicon(
      darkSource,
      path.join(outputDir, "favicon-16x16-dark.png"),
      16,
      "16x16 dark favicon"
    );
    await generateFavicon(
      darkSource,
      path.join(outputDir, "favicon-32x32-dark.png"),
      32,
      "32x32 dark favicon"
    );

    // Generate Apple Touch Icon
    await generateAppleTouchIcon(
      mainIcon,
      path.join(outputDir, "apple-touch-icon.png")
    );

    // Generate favicon.ico (as PNG for now)
    await generateFaviconIco(mainIcon, path.join(outputDir, "favicon.ico"));

    // Generate SVG logo
    let logoSource = mainIcon;
    if (logoUrl && logoUrl !== iconUrl) {
      // Download separate logo image
      const logoTemp = path.join(outputDir, "logo_temp.png");
      if (await downloadImage(logoUrl, logoTemp, "logo image")) {
        logoSource = logoTemp;
      } else {
        printWarning("Failed to download logo, using icon as fallback");
      }
    }

    await generateSvgLogo(logoSource, path.join(outputDir, "logo.svg"));

    // Clean up logo temp file if it was created
    if (logoSource !== mainIcon) {
      try {
        await fs.unlink(logoSource);
      } catch {}
    }

    // Clean up temporary files
    await fs.unlink(mainIcon);
    if (blackIcon) {
      try {
        await fs.unlink(blackIcon);
      } catch {}
    }

    printStatus("Icon generation completed successfully!");

    // List generated files
    try {
      const files = await fs.readdir(outputDir);
      const iconFiles = files.filter(
        (f) => f.endsWith(".png") || f.endsWith(".ico") || f.endsWith(".svg")
      );
      printStatus(`Generated files in ${outputDir}:`);
      for (const file of iconFiles) {
        const stats = await fs.stat(path.join(outputDir, file));
        console.log(`    ${file} (${stats.size} bytes)`);
      }
    } catch (error) {
      printWarning("Could not list generated files");
    }
  } catch (error) {
    printError(`Icon generation failed: ${error.message}`);
    process.exit(1);
  }
};

// Styles generation
const generateStyles = async () => {
  printHeader("Generating custom styles...");

  const outputDir = "custom/styles";
  await fs.mkdir(outputDir, { recursive: true });

  // Read environment variables with defaults
  const primaryColor = process.env.CUSTOM_PRIMARY_COLOR || "#0a0d10";
  const secondaryColor = process.env.CUSTOM_SECONDARY_COLOR || "#0a0d10";
  const redColor = process.env.CUSTOM_RED_COLOR || "#d74949";
  const greenColor = process.env.CUSTOM_GREEN_COLOR || "#319236";
  const textMutedColor = process.env.CUSTOM_TEXT_MUTED_COLOR || "#888";
  const secondaryBackgroundColor =
    process.env.CUSTOM_SECONDARY_BACKGROUND_COLOR || "#f1f1f1";
  const secondaryTextColor =
    process.env.CUSTOM_SECONDARY_TEXT_COLOR || "#7a7a7a";

  const forceLinkUnderline = toBoolean(process.env.CUSTOM_FORCE_LINK_UNDERLINE);
  const lighterPrimaryHover = toBoolean(
    process.env.CUSTOM_LIGHTER_PRIMARY_HOVER
  );
  const lighterSecondaryHover = toBoolean(
    process.env.CUSTOM_LIGHTER_SECONDARY_HOVER
  );
  const headerLogo = toBoolean(process.env.CUSTOM_HEADER_LOGO);

  // Validate colors
  const colors = [
    [primaryColor, "CUSTOM_PRIMARY_COLOR"],
    [secondaryColor, "CUSTOM_SECONDARY_COLOR"],
    [redColor, "CUSTOM_RED_COLOR"],
    [greenColor, "CUSTOM_GREEN_COLOR"],
    [textMutedColor, "CUSTOM_TEXT_MUTED_COLOR"],
    [secondaryBackgroundColor, "CUSTOM_SECONDARY_BACKGROUND_COLOR"],
    [secondaryTextColor, "CUSTOM_SECONDARY_TEXT_COLOR"],
  ];

  for (const [color, name] of colors) {
    if (!validateHexColor(color, name)) {
      process.exit(1);
    }
  }

  printStatus("Using colors:");
  printStatus(`  Primary: ${primaryColor}`);
  printStatus(`  Secondary: ${secondaryColor}`);
  printStatus(`  Red: ${redColor}`);
  printStatus(`  Green: ${greenColor}`);
  printStatus(`  Text Muted: ${textMutedColor}`);
  printStatus(`  Secondary Background: ${secondaryBackgroundColor}`);
  printStatus(`  Secondary Text: ${secondaryTextColor}`);

  // Generate the SCSS content
  const scssContent = `@use "sass:color";

// Override theme colors for Bootstrap.
// These are defined before the imports below for use in Ilmomasiina's SCSS.

// For Bootstrap components, the overrides are made in ilmomasiina-frontend/src/styles/app.scss.
// If you want to override more colors, you'll also need to add them to the @use there.

// CUSTOMIZED COLORS - Generated by Ilmomasiina Customizer
$primary: ${primaryColor} !default;
$secondary: ${secondaryColor} !default;
$red: ${redColor} !default; // further assigned to $danger by Bootstrap
$green: ${greenColor} !default; // further assigned to $success by Bootstrap
$text-muted: ${textMutedColor} !default;

// Links are impossible to see with dark primary colors.
// You can disable this if you use something light.
$force-link-underline: ${forceLinkUnderline} !default;

// Default button hover color logic doesn't work with dark primary colors.
// You can disable this if you use something light.
$lighter-primary-hover: ${lighterPrimaryHover} !default;
$lighter-secondary-hover: ${lighterSecondaryHover} !default;

// Additional colors, only used by Ilmomasiina's SCSS.

$secondary-background: ${secondaryBackgroundColor} !default;
$secondary-text-color: ${secondaryTextColor} !default;

// If you don't want a header logo, set this to false.
$header-logo: ${headerLogo} !default;

// Import Bootstrap core mixins/variables/functions for use in Ilmomasiina's SCSS.

@import "bootstrap/scss/functions";
@import "bootstrap/scss/variables";
@import "bootstrap/scss/mixins";

// Colors for signup states. You can use Bootstrap variables here.

$signup-state-not-opened: $body-color !default;
$signup-state-opened: $green !default;
$signup-state-closed: $red !default;
$signup-state-disabled: color.change($body-color, $alpha: 0.45) !default;
`;

  const outputFile = path.join(outputDir, "_definitions.scss");
  await fs.writeFile(outputFile, scssContent);

  printStatus(
    `Custom _definitions.scss generated successfully at: ${outputFile}`
  );
  printStatus(`File size: ${scssContent.length} bytes`);
};

// Main function
const main = async () => {
  try {
    const args = process.argv.slice(2);
    const isClean = args.includes("--clean") || args.includes("-c");
    const isIconsOnly = args.includes("--icons-only");
    const isStylesOnly = args.includes("--styles-only");
    const isHelp = args.includes("--help") || args.includes("-h");

    if (isHelp) {
      console.log("Usage: node customize.js [options]");
      console.log("");
      console.log("Options:");
      console.log("  -h, --help        Show this help message");
      console.log(
        "  -c, --clean       Clean previous customizations before generating new ones"
      );
      console.log("  --icons-only      Generate only icons");
      console.log("  --styles-only     Generate only styles");
      console.log("");
      console.log("Environment variables (set in .env file):");
      console.log(
        "  ICON_URL                    - URL to main icon image (required)"
      );
      console.log(
        "  LOGO_URL                    - URL to logo image for SVG (optional, uses ICON_URL if not set)"
      );
      console.log(
        "  ICON_BLACK_URL              - URL to black variant of icon (optional)"
      );
      console.log(
        "  CUSTOM_PRIMARY_COLOR        - Primary color (default: #0a0d10)"
      );
      console.log(
        "  CUSTOM_SECONDARY_COLOR      - Secondary color (default: #0a0d10)"
      );
      console.log(
        "  CUSTOM_RED_COLOR            - Red/danger color (default: #d74949)"
      );
      console.log(
        "  CUSTOM_GREEN_COLOR          - Green/success color (default: #319236)"
      );
      console.log(
        "  CUSTOM_TEXT_MUTED_COLOR     - Muted text color (default: #888)"
      );
      console.log("  And more... see .env file for full list");
      process.exit(0);
    }

    printHeader("Ilmomasiina Customizer");
    printStatus("Starting customization process...");

    // Validate required environment variables
    if (!process.env.ICON_URL && !isStylesOnly) {
      printError("Missing required environment variable: ICON_URL");
      printError("Please set this variable in your .env file");
      process.exit(1);
    }

    // Setup directories
    await setupDirectories();

    // Clean previous customizations if requested
    if (isClean) {
      await cleanPrevious();
    }

    // Create .gitignore for custom folder
    const gitignorePath = "custom/.gitignore";
    try {
      await fs.access(gitignorePath);
    } catch {
      printStatus("Creating .gitignore for custom folder...");
      await fs.writeFile(
        gitignorePath,
        "# Generated customization files\npublic/\nstyles/\n"
      );
      printStatus(`Created ${gitignorePath}`);
    }

    // Generate customizations based on options
    if (isStylesOnly) {
      await generateStyles();
    } else if (isIconsOnly) {
      await generateIcons();
    } else {
      // Generate both
      await generateIcons();
      await generateStyles();
    }

    // Display summary
    printHeader("Customization Summary");
    console.log("Generated files:");

    try {
      // List generated icons
      const publicFiles = await fs.readdir("custom/public");
      const iconFiles = publicFiles.filter(
        (f) => f.endsWith(".png") || f.endsWith(".ico") || f.endsWith(".svg")
      );
      if (iconFiles.length > 0) {
        console.log(`  Icons: ${iconFiles.length} files in custom/public/`);
        for (const file of iconFiles.sort()) {
          console.log(`    ${file}`);
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    try {
      // Check for generated styles
      await fs.access("custom/styles/_definitions.scss");
      const stats = await fs.stat("custom/styles/_definitions.scss");
      console.log("  Styles: custom/styles/_definitions.scss");
      console.log(`    Size: ${stats.size} bytes`);
    } catch (error) {
      // File might not exist
    }

    console.log("");
    printStatus("Customization completed successfully!");
    printStatus(
      "You can now build the Docker image with these customizations."
    );
  } catch (error) {
    printError(`Customization failed: ${error.message}`);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, generateIcons, generateStyles };
