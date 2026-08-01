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
  && npm install -g @agentclientprotocol/codex-acp@latest @openai/codex@latest

ENV CODEX_LOG_STDERR=0

ENTRYPOINT ["codex-acp"]
