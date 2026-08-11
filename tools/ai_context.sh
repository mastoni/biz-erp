#!/usr/bin/env bash

set -e

echo "========================================"
echo "AI DEVELOPMENT CONTEXT"
echo "========================================"

echo
echo "===== PROJECT ROOT ====="
pwd

echo
echo "===== GIT STATUS ====="
git status --short

echo
echo "===== PROJECT STRUCTURE ====="
find . -maxdepth 2 -type d \
  -not -path './.git*' \
  -not -path './node_modules*' \
  | sort

echo
echo "===== MOBILE STRUCTURE ====="
if [ -d "apps/mobile" ]; then
    find apps/mobile/lib -maxdepth 3 -type f | sort
else
    echo "apps/mobile NOT FOUND"
fi

echo
echo "===== FLUTTER ====="
if command -v flutter >/dev/null 2>&1; then
    flutter --version
else
    echo "Flutter not found"
fi

echo
echo "===== DART ====="
if command -v dart >/dev/null 2>&1; then
    dart --version
else
    echo "Dart not found"
fi

echo
echo "===== PUBSPEC ====="
if [ -f "apps/mobile/pubspec.yaml" ]; then
    cat apps/mobile/pubspec.yaml
else
    echo "pubspec.yaml NOT FOUND"
fi

echo
echo "========================================"
echo "END"
echo "========================================"