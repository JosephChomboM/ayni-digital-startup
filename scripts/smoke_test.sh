#!/usr/bin/env bash
# Usage: smoke_test.sh <url> [expected-text]
# Retries until the URL answers 2xx and (optionally) its body contains expected-text,
# e.g. the commit SHA, so we know the *new* deploy is the one responding.
set -euo pipefail

url="$1"
expected="${2:-}"
attempts="${SMOKE_ATTEMPTS:-20}"
delay="${SMOKE_DELAY:-15}"

for i in $(seq 1 "$attempts"); do
  if body=$(curl -fsS --max-time 10 "$url"); then
    if [[ -z "$expected" || "$body" == *"$expected"* ]]; then
      echo "OK (intento $i): $url"
      exit 0
    fi
    echo "Intento $i/$attempts: responde, pero todavía no es la versión ${expected}"
  else
    echo "Intento $i/$attempts: sin respuesta"
  fi
  sleep "$delay"
done

echo "::error::Smoke test falló: $url"
exit 1
