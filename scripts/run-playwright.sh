#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compat_dir="${PLAYWRIGHT_WEBKIT_COMPAT_DIR:-${project_root}/.cache/playwright-webkit-compat}"
icu_dir="${compat_dir}/icu"
jpeg_dir="${compat_dir}/jpeg"

if [[ -f "${icu_dir}/libicudata.so.74" && -f "${icu_dir}/libicuuc.so.74" && \
      -f "${icu_dir}/libicui18n.so.74" && -f "${jpeg_dir}/libjpeg.so.8" ]]; then
  export LD_LIBRARY_PATH="${icu_dir}:${jpeg_dir}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
  export PLAYWRIGHT_WEBKIT_LD_PRELOAD="${icu_dir}/libicudata.so.74:${icu_dir}/libicuuc.so.74:${icu_dir}/libicui18n.so.74:${jpeg_dir}/libjpeg.so.8"
fi

exec npx playwright test "$@"
