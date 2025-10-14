#!/usr/bin/env bash
set -euo pipefail

# Optional output directory argument defaults to ./releases
OUTPUT_DIR=${1:-releases}

# Ensure we are inside repository root before archiving
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

mkdir -p "$OUTPUT_DIR"

# Prepare timestamped metadata similar to the GitHub Actions workflow
TIMESTAMP_TAG=$(date -u +"%Y%m%d-%H%M%S")
TIMESTAMP_DISPLAY=$(date -u +"%Y-%m-%d %H:%M UTC")
ARCHIVE_NAME="nvc-app-${TIMESTAMP_TAG}.zip"
TAG_NAME="release-local-${TIMESTAMP_TAG}"
TITLE="Stable Local Release - ${TIMESTAMP_DISPLAY}"

ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

echo "Creating archive at ${ARCHIVE_PATH}" >&2

git archive --format=zip --output="${ARCHIVE_PATH}" HEAD

cat <<INFO
Archive created successfully.
  tag:    ${TAG_NAME}
  title:  ${TITLE}
  file:   ${ARCHIVE_PATH}
INFO
