FROM rust:1-slim-bookworm AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates build-essential git pkg-config libssl-dev \
  && rm -rf /var/lib/apt/lists/*

ENV CARGO_BUILD_JOBS=1 \
    CARGO_PROFILE_DEV_DEBUG=0 \
    CARGO_PROFILE_DEV_INCREMENTAL=false

RUN cargo install --debug -j 1 --locked --git https://github.com/danduma/codex-acp.git --branch main codex-acp

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    fd-find \
    git \
    jq \
    less \
    make \
    openssh-client \
    pkg-config \
    python3 \
    ripgrep \
    sqlite3 \
    zsh \
  && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && npm install -g @openai/codex

COPY --from=builder /usr/local/cargo/bin/codex-acp /usr/local/bin/codex-acp

ENV CODEX_LOG_STDERR=0

ENTRYPOINT ["codex-acp"]
