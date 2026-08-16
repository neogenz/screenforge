#!/bin/sh
set -eu

version=8.29.1
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin_arm64; checksum=69836c841d7e648fb30ff4846f8c3587855c5754ed02b8510caaf6008f65d177 ;;
  Darwin-x86_64) platform=darwin_x64; checksum=2cd739c684bf3f543f4f37774075c276e40a72bb16c4c5bb9dfd27bf4a4465a7 ;;
  Linux-x86_64) platform=linux_x64; checksum=e4eb209d04e20339d77122a3bdf9cd41351255cfb27ebcb75e85325e04f88924 ;;
  *) echo 'Gitleaks setup supports macOS arm64/x64 and Linux x64 only.' >&2; exit 1 ;;
esac

destination=node_modules/.bin/gitleaks
temporary=$(mktemp -d "${TMPDIR:-/tmp}/screenforge-gitleaks.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
archive="$temporary/gitleaks.tar.gz"
url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${platform}.tar.gz"
curl -fL --retry 6 --retry-all-errors --retry-delay 5 --connect-timeout 30 -o "$archive" "$url"
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$archive" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
fi
test "$actual" = "$checksum" || { echo 'Gitleaks checksum mismatch.' >&2; exit 1; }
directory=$(dirname "$destination")
mkdir -p "$directory"
tar -xzf "$archive" -C "$directory" gitleaks
chmod 0755 "$destination"
test "$("$destination" version)" = "$version"
