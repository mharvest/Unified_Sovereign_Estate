#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/anvil.env}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ANVIL_LOG="$PROJECT_ROOT/.anvil.log"
ANVIL_PID_FILE="$PROJECT_ROOT/.anvil.pid"
DEPLOY_OUTPUT="${DEPLOY_OUTPUT_PATH:-$PROJECT_ROOT/broadcast/devnet/generated.env}"

if [ -f "$HOME/.bashrc" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.bashrc"
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export DEPLOY_OUTPUT_PATH="$DEPLOY_OUTPUT"
export RPC_URL

mkdir -p "$(dirname "$DEPLOY_OUTPUT")"

start_anvil() {
  if [ -f "$ANVIL_PID_FILE" ] && kill -0 "$(cat "$ANVIL_PID_FILE")" >/dev/null 2>&1; then
    echo "[devnet] anvil already running (pid $(cat "$ANVIL_PID_FILE"))"
  else
    echo "[devnet] starting anvil"
    anvil --block-time 1 --chain-id 777 --port "${ANVIL_PORT:-8545}" --silent --accounts 10 >"$ANVIL_LOG" 2>&1 &
    echo $! >"$ANVIL_PID_FILE"
    sleep 2
  fi
}

stop_anvil() {
  if [ -f "$ANVIL_PID_FILE" ]; then
    if kill -0 "$(cat "$ANVIL_PID_FILE")" >/dev/null 2>&1; then
      kill "$(cat "$ANVIL_PID_FILE")" >/dev/null 2>&1 || true
    fi
    rm -f "$ANVIL_PID_FILE"
    echo "[devnet] anvil stopped"
  fi
}

start_oracle() {
  pushd "$PROJECT_ROOT/services/eyeion-oracle" >/dev/null
  npm install --no-fund --no-audit >/dev/null 2>&1
 ORACLE_OFFLINE=false \
 RPC_URL="$RPC_URL" \
 CSDN_ADDRESS="${CSDN_ADDRESS:-0x0000000000000000000000000000000000000000}" \
 ROUTER_ADDRESS="${ROUTER_ADDRESS:-0x0000000000000000000000000000000000000000}" \
 SAFEVAULT_CACHE_PATH="${SAFEVAULT_CACHE_PATH:-$PROJECT_ROOT/services/eyeion-oracle/safevault-cache.json}" \
 EYEION_API_BASE="${EYEION_API_BASE:-mock}" \
  CHAIN_ID="${CHAIN_ID:-777}" \
  node index.js >"$PROJECT_ROOT/.oracle.log" 2>&1 &
  ORACLE_PID=$!
  popd >/dev/null
  echo "$ORACLE_PID" > "$PROJECT_ROOT/.oracle.pid"
  sleep 2
}

stop_oracle() {
  local pid_file="$PROJECT_ROOT/.oracle.pid"
  if [ -f "$pid_file" ]; then
    if kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
      kill "$(cat "$pid_file")" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
    echo "[devnet] oracle stopped"
  fi
}

cleanup() {
  stop_oracle || true
  stop_anvil || true
}

trap cleanup EXIT

start_anvil

pushd "$PROJECT_ROOT" >/dev/null

forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url "$RPC_URL" -vvvv

BROADCAST_FILE="$PROJECT_ROOT/broadcast/Deploy.s.sol/777/run-latest.json"
if [ ! -f "$BROADCAST_FILE" ]; then
  echo "[devnet] broadcast file not found: $BROADCAST_FILE" >&2
  exit 1
fi

declare -A ADDR
while IFS=$'\t' read -r name addr; do
  ADDR[$name]="$addr"
done < <(jq -r '.transactions[] | select(.contractAddress != null) | [.contractName, .contractAddress] | @tsv' "$BROADCAST_FILE")

export HRVST_ADDRESS="${ADDR[HRVSTToken]}"
export CSDN_ADDRESS="${ADDR[CSDNInstrument]}"
export KYC_ADDRESS="${ADDR[KycAllowlist]}"
export ROUTER_ADDRESS="${ADDR[CSDNRouter]}"
export TIMELOCK_ADDRESS="${ADDR[TimelockController]}"
export GOVERNOR_ADDRESS="${ADDR[EstateGovernor]}"

if [ -z "$HRVST_ADDRESS" ] || [ -z "$CSDN_ADDRESS" ]; then
  echo "[devnet] failed to parse deployment addresses" >&2
  exit 1
fi

stop_oracle || true
start_oracle

forge script script/GrantRolesAndOriginate.s.sol:GrantRolesAndOriginate --broadcast --rpc-url "$RPC_URL" -vvvv

forge script script/InsureSubscribeRedeemDemo.s.sol:InsureSubscribeRedeemDemo --broadcast --rpc-url "$RPC_URL" -vvvv

popd >/dev/null

sleep 2

echo "[devnet] demo completed. Oracle log at $PROJECT_ROOT/.oracle.log"
