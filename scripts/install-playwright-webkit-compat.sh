#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compat_dir="${PLAYWRIGHT_WEBKIT_COMPAT_DIR:-${project_root}/.cache/playwright-webkit-compat}"
temporary_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${temporary_dir}"
}

trap cleanup EXIT

for command_name in curl sha256sum rpm2cpio cpio ar tar; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${command_name}" >&2
    exit 1
  fi
done

icu_url='https://kojipkgs.fedoraproject.org/packages/libicu74/74.2/3.fc43/x86_64/libicu74-74.2-3.fc43.x86_64.rpm'
icu_sha256='6211f2d3edc990366d0ed4b5c7d1d9e0ba6085371d2db4257151d64c6b275dfa'
jpeg_url='https://archive.ubuntu.com/ubuntu/pool/main/libj/libjpeg-turbo/libjpeg-turbo8_2.1.5-2ubuntu2_amd64.deb'
jpeg_sha256='f68b5b23bc8a1688fb787d2aed7e2cdf895a73022f6a5025e183162dac4500b2'

mkdir -p "${compat_dir}/icu" "${compat_dir}/jpeg"

curl --fail --location --retry 2 --output "${temporary_dir}/libicu74.rpm" "${icu_url}"
printf '%s  %s\n' "${icu_sha256}" "${temporary_dir}/libicu74.rpm" | sha256sum --check --strict -

mkdir "${temporary_dir}/icu"
(
  cd "${temporary_dir}/icu"
  rpm2cpio "${temporary_dir}/libicu74.rpm" | cpio -idm --quiet --no-absolute-filenames
)
cp -a "${temporary_dir}/icu/usr/lib64"/libicu*.so.74* "${compat_dir}/icu/"

curl --fail --location --retry 2 --output "${temporary_dir}/libjpeg-turbo8.deb" "${jpeg_url}"
printf '%s  %s\n' "${jpeg_sha256}" "${temporary_dir}/libjpeg-turbo8.deb" | sha256sum --check --strict -

mkdir "${temporary_dir}/jpeg-deb" "${temporary_dir}/jpeg"
(
  cd "${temporary_dir}/jpeg-deb"
  ar x "${temporary_dir}/libjpeg-turbo8.deb"
)
tar --zstd -xf "${temporary_dir}/jpeg-deb/data.tar.zst" -C "${temporary_dir}/jpeg"
cp -a "${temporary_dir}/jpeg/usr/lib/x86_64-linux-gnu"/libjpeg.so.8* "${compat_dir}/jpeg/"

printf 'Playwright WebKit compatibility libraries installed in %s\n' "${compat_dir}"
