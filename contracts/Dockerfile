# Harvest Contracts – Foundry build & test
FROM ghcr.io/foundry-rs/foundry:latest
WORKDIR /contracts
COPY . .
RUN forge build
CMD ["anvil", "--host", "0.0.0.0", "--chain-id", "777", "--block-time", "2"]
