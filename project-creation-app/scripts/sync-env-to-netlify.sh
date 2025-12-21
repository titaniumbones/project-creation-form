#!/bin/bash
#
# Sync environment variables from .env to Netlify
#
# Usage:
#   ./scripts/sync-env-to-netlify.sh           # Dry run (show commands)
#   ./scripts/sync-env-to-netlify.sh --execute # Actually set the variables
#   ./scripts/sync-env-to-netlify.sh --help    # Show help
#
# Prerequisites:
#   - Netlify CLI installed: npm install -g netlify-cli
#   - Logged in to Netlify: netlify login
#   - Site linked: netlify link (or run from project root)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

# Production OAuth relay URL (replace localhost with production URL)
PRODUCTION_OAUTH_RELAY_URL="https://airtable-asana-integration-oauth.netlify.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Sync environment variables from .env to Netlify"
    echo ""
    echo "Usage:"
    echo "  $0              Dry run - show commands that would be executed"
    echo "  $0 --execute    Execute the commands to set Netlify env vars"
    echo "  $0 --delete     Delete all VITE_* env vars from Netlify"
    echo "  $0 --help       Show this help message"
    echo ""
    echo "Notes:"
    echo "  - Reads from: ${ENV_FILE}"
    echo "  - VITE_OAUTH_RELAY_URL will be set to production URL:"
    echo "    ${PRODUCTION_OAUTH_RELAY_URL}"
    echo ""
    echo "Prerequisites:"
    echo "  1. Install Netlify CLI: npm install -g netlify-cli"
    echo "  2. Login to Netlify: netlify login"
    echo "  3. Link your site: netlify link"
}

check_prerequisites() {
    if ! command -v netlify &> /dev/null; then
        echo -e "${RED}Error: Netlify CLI not found${NC}"
        echo "Install with: npm install -g netlify-cli"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: .env file not found at ${ENV_FILE}${NC}"
        echo "Copy .env.example to .env and fill in your values"
        exit 1
    fi
}

parse_env_file() {
    # Read .env file and output VAR=VALUE pairs for VITE_* variables
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        # Only process VITE_* variables
        if [[ "$line" =~ ^VITE_ ]]; then
            # Extract variable name and value
            var_name="${line%%=*}"
            var_value="${line#*=}"

            # Remove surrounding quotes if present
            var_value="${var_value#\"}"
            var_value="${var_value%\"}"
            var_value="${var_value#\'}"
            var_value="${var_value%\'}"

            echo "${var_name}=${var_value}"
        fi
    done < "$ENV_FILE"
}

generate_commands() {
    local execute=$1
    local count=0

    echo -e "${BLUE}Environment variables to sync:${NC}"
    echo ""

    while IFS='=' read -r var_name var_value; do
        # Skip empty lines
        [[ -z "$var_name" ]] && continue

        # Override OAUTH_RELAY_URL with production URL
        if [[ "$var_name" == "VITE_OAUTH_RELAY_URL" ]]; then
            var_value="$PRODUCTION_OAUTH_RELAY_URL"
            echo -e "  ${YELLOW}${var_name}${NC}=${var_value} ${YELLOW}(production override)${NC}"
        else
            # Mask sensitive values in output
            if [[ ${#var_value} -gt 10 ]]; then
                display_value="${var_value:0:6}...${var_value: -4}"
            else
                display_value="$var_value"
            fi
            echo -e "  ${GREEN}${var_name}${NC}=${display_value}"
        fi

        if [[ "$execute" == "true" ]]; then
            netlify env:set "$var_name" "$var_value" --context production
        fi

        ((count++))
    done < <(parse_env_file)

    echo ""
    echo -e "${BLUE}Total: ${count} variables${NC}"

    if [[ "$execute" != "true" ]]; then
        echo ""
        echo -e "${YELLOW}Dry run complete. Run with --execute to apply changes.${NC}"
        echo ""
        echo "Commands that would be executed:"
        while IFS='=' read -r var_name var_value; do
            [[ -z "$var_name" ]] && continue
            if [[ "$var_name" == "VITE_OAUTH_RELAY_URL" ]]; then
                var_value="$PRODUCTION_OAUTH_RELAY_URL"
            fi
            echo "  netlify env:set $var_name \"$var_value\" --context production"
        done < <(parse_env_file)
    else
        echo ""
        echo -e "${GREEN}Successfully synced ${count} environment variables to Netlify${NC}"
    fi
}

delete_env_vars() {
    echo -e "${YELLOW}Deleting VITE_* environment variables from Netlify...${NC}"
    echo ""

    # Get list of env vars from Netlify
    local vars=$(netlify env:list --json 2>/dev/null | grep -o '"key":"VITE_[^"]*"' | cut -d'"' -f4)

    if [[ -z "$vars" ]]; then
        echo "No VITE_* variables found on Netlify"
        return
    fi

    for var in $vars; do
        echo -e "  Deleting: ${RED}${var}${NC}"
        netlify env:unset "$var" --context production
    done

    echo ""
    echo -e "${GREEN}Done${NC}"
}

# Main
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --execute)
        check_prerequisites
        echo -e "${GREEN}Syncing environment variables to Netlify...${NC}"
        echo ""
        generate_commands true
        ;;
    --delete)
        check_prerequisites
        delete_env_vars
        ;;
    "")
        check_prerequisites
        echo -e "${BLUE}Dry run - showing what would be synced${NC}"
        echo ""
        generate_commands false
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
