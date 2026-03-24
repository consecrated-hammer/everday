#!/bin/sh
set -eu

if [ -z "${CI_BUILD_NUMBER:-}" ]; then
  echo "CI_BUILD_NUMBER not set; leaving CURRENT_PROJECT_VERSION unchanged."
  exit 0
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

for candidate in \
  "$SCRIPT_DIR/../EverdayIOS.xcodeproj/project.pbxproj" \
  "${CI_WORKSPACE:-}/apps/ios/EverdayIOS/EverdayIOS.xcodeproj/project.pbxproj" \
  "${CI_WORKSPACE:-}/EverdayIOS.xcodeproj/project.pbxproj" \
  "$PWD/EverdayIOS.xcodeproj/project.pbxproj"
do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    PROJECT_PATH="$candidate"
    break
  fi
done

if [ -z "${PROJECT_PATH:-}" ]; then
  echo "Xcode project not found."
  echo "CI_WORKSPACE=${CI_WORKSPACE:-<unset>}"
  echo "PWD=$PWD"
  echo "SCRIPT_DIR=$SCRIPT_DIR"
  exit 1
fi

echo "Using project file: $PROJECT_PATH"

python3 - "$PROJECT_PATH" "$CI_BUILD_NUMBER" <<'PY'
from pathlib import Path
import re
import sys

project_path = Path(sys.argv[1])
build_number = sys.argv[2].strip()

text = project_path.read_text()
updated = re.sub(
    r"CURRENT_PROJECT_VERSION = [^;]+;",
    f"CURRENT_PROJECT_VERSION = {build_number};",
    text,
)

if text == updated:
    print("CURRENT_PROJECT_VERSION entries were not found")
    sys.exit(1)

project_path.write_text(updated)
print(f"Set CURRENT_PROJECT_VERSION to {build_number}")
PY
