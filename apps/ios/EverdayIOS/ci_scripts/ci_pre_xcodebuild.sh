#!/bin/sh
set -eu

if [ -z "${CI_BUILD_NUMBER:-}" ]; then
  echo "CI_BUILD_NUMBER not set; leaving CURRENT_PROJECT_VERSION unchanged."
  exit 0
fi

PROJECT_PATH="${CI_WORKSPACE:-$PWD}/EverdayIOS.xcodeproj/project.pbxproj"

if [ ! -f "$PROJECT_PATH" ]; then
  echo "Xcode project not found at $PROJECT_PATH"
  exit 1
fi

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
