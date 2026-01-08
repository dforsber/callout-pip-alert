#!/bin/bash

# App Store Screenshot Automation Script
# Takes screenshots from iOS simulators for all required device sizes

set -e

# Change to apps/mobile directory (script can be run from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/apps/mobile"

if [ ! -d "$MOBILE_DIR/src-tauri" ]; then
  echo "Error: Could not find apps/mobile directory"
  exit 1
fi

cd "$MOBILE_DIR"

# Screenshot output directory
OUTPUT_DIR="$PROJECT_ROOT/screenshots"
mkdir -p "$OUTPUT_DIR"

# Required device types for App Store
# Format: "Display Name|Simulator Device Type|Folder Name"
#
# App Store requires these sizes:
#   - 6.7" (or 6.9") - iPhone 15/16/17 Pro Max
#   - 6.5" - iPhone 14 Plus, 11 Pro Max (may need older Xcode runtime)
#   - 5.5" - iPhone 8 Plus (may need older Xcode runtime)
#
# NOTE: If you only have newer simulators, App Store Connect will
# auto-scale screenshots for older devices from the 6.7"/6.9" versions.
#
# To add older simulators:
#   Xcode > Settings > Platforms > + > iOS Simulators
#
DEVICES=(
  "iPhone 17 Pro Max (6.9\")|iPhone 17 Pro Max|6.9-inch"
  "iPhone 17 Pro (6.3\")|iPhone 17 Pro|6.3-inch"
)

# Uncomment these if you have older simulators installed:
# DEVICES+=(
#   "iPhone 15 Pro Max (6.7\")|iPhone 15 Pro Max|6.7-inch"
#   "iPhone 14 Plus (6.5\")|iPhone 14 Plus|6.5-inch"
#   "iPhone 8 Plus (5.5\")|iPhone 8 Plus|5.5-inch"
# )

# Pages to screenshot
PAGES=("login" "incidents" "incident-detail" "settings")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        APP STORE SCREENSHOT AUTOMATION SCRIPT              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if simulators are available
check_simulator() {
  local device_type="$1"
  xcrun simctl list devices available | grep -q "$device_type"
}

# Get simulator UDID
get_simulator_udid() {
  local device_type="$1"
  xcrun simctl list devices available | grep "$device_type" | head -1 | grep -oE '\([A-F0-9-]{36}\)' | tr -d '()'
}

# Boot simulator
boot_simulator() {
  local udid="$1"
  local name="$2"
  echo -e "${YELLOW}Booting $name...${NC}"
  xcrun simctl boot "$udid" 2>/dev/null || true
  # Wait for boot
  sleep 3
  # Open Simulator app
  open -a Simulator
  sleep 2
}

# Shutdown simulator
shutdown_simulator() {
  local udid="$1"
  echo -e "${YELLOW}Shutting down simulator...${NC}"
  xcrun simctl shutdown "$udid" 2>/dev/null || true
}

# Take screenshot
take_screenshot() {
  local udid="$1"
  local folder="$2"
  local page="$3"

  mkdir -p "$OUTPUT_DIR/$folder"
  local filename="$OUTPUT_DIR/$folder/${page}.png"

  xcrun simctl io "$udid" screenshot "$filename"
  echo -e "${GREEN}✓ Saved: $filename${NC}"
}

# Install and launch app (uses APP_PATH set earlier)
install_and_launch_app() {
  local udid="$1"

  echo -e "${YELLOW}Installing app from: $APP_PATH${NC}"
  xcrun simctl install "$udid" "$APP_PATH"

  echo -e "${YELLOW}Launching app...${NC}"
  xcrun simctl launch "$udid" com.boilingdata.cloudalarms
  sleep 3
}

# Main screenshot flow for one device
screenshot_device() {
  local display_name="$1"
  local device_type="$2"
  local folder_name="$3"

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Device: $display_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if ! check_simulator "$device_type"; then
    echo -e "${RED}⚠ Simulator '$device_type' not found. Skipping.${NC}"
    return
  fi

  local udid=$(get_simulator_udid "$device_type")

  if [ -z "$udid" ]; then
    echo -e "${RED}⚠ Could not get UDID for '$device_type'. Skipping.${NC}"
    return
  fi

  echo -e "${GREEN}Found simulator: $udid${NC}"

  # Boot and install
  boot_simulator "$udid" "$display_name"
  install_and_launch_app "$udid"

  echo ""
  echo -e "${GREEN}App is running on $display_name${NC}"
  echo ""

  # Screenshot each page
  for page in "${PAGES[@]}"; do
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    case $page in
      "login")
        echo -e "${YELLOW}  Navigate to: LOGIN page${NC}"
        echo -e "${YELLOW}  (Sign out if needed, or go to Settings > Sign Out)${NC}"
        ;;
      "incidents")
        echo -e "${YELLOW}  Navigate to: INCIDENTS page (main alarm list)${NC}"
        echo -e "${YELLOW}  (Enable demo mode in Settings for sample data)${NC}"
        ;;
      "incident-detail")
        echo -e "${YELLOW}  Navigate to: INCIDENT DETAIL page${NC}"
        echo -e "${YELLOW}  (Tap on any incident to open detail view)${NC}"
        ;;
      "settings")
        echo -e "${YELLOW}  Navigate to: SETTINGS page${NC}"
        echo -e "${YELLOW}  (Tap the gear icon in bottom nav)${NC}"
        ;;
    esac
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    read -p "Press ENTER when ready to capture '$page' screenshot..."

    take_screenshot "$udid" "$folder_name" "$page"
  done

  # Shutdown simulator
  shutdown_simulator "$udid"
}

# Check for simulator build - look in the Xcode derived data or build for simulator
echo -e "${YELLOW}Checking for simulator build...${NC}"

# Look for simulator build in DerivedData (from tauri ios dev)
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
APP_PATH=$(find "$DERIVED_DATA" -path "*mobile*" -path "*debug-iphonesimulator*" -name "*.app" -type d 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
  # Try to find in Tauri's target directory for simulator builds
  APP_PATH=$(find ./src-tauri/target -name "*.app" -type d 2>/dev/null | head -1)
fi

if [ -z "$APP_PATH" ]; then
  echo ""
  echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ERROR: No simulator build found!                          ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}The regular 'tauri ios build' creates device builds, not simulator builds.${NC}"
  echo ""
  echo -e "${YELLOW}Option 1: Run the app in dev mode first to create simulator build:${NC}"
  echo -e "  cd apps/mobile"
  echo -e "  pnpm tauri ios dev"
  echo -e "  (Let it launch once, then Ctrl+C)"
  echo ""
  echo -e "${YELLOW}Option 2: Build specifically for simulator:${NC}"
  echo -e "  cd apps/mobile"
  echo -e "  pnpm tauri ios build --target aarch64-apple-ios-sim"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ Found simulator app: $APP_PATH${NC}"
echo ""

# Process each device
for device_info in "${DEVICES[@]}"; do
  IFS='|' read -r display_name device_type folder_name <<< "$device_info"
  screenshot_device "$display_name" "$device_type" "$folder_name"
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  SCREENSHOTS COMPLETE!                                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Screenshots saved to: ${BLUE}$OUTPUT_DIR/${NC}"
echo ""
ls -la "$OUTPUT_DIR"
