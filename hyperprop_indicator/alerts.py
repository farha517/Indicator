"""Alert delivery: console always, plus Discord / Telegram if configured via env vars.

  DISCORD_WEBHOOK_URL   - Discord channel webhook URL
  TELEGRAM_BOT_TOKEN    - Telegram bot token
  TELEGRAM_CHAT_ID      - Telegram chat id to message
"""
from __future__ import annotations

import os
import sys

import requests


def send(message: str) -> None:
    print(message, flush=True)
    sys.stdout.write("\a")  # terminal bell

    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if url:
        try:
            requests.post(url, json={"content": message}, timeout=10)
        except requests.RequestException as e:
            print(f"[alert] Discord failed: {e}", file=sys.stderr)

    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if token and chat:
        try:
            requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                          json={"chat_id": chat, "text": message}, timeout=10)
        except requests.RequestException as e:
            print(f"[alert] Telegram failed: {e}", file=sys.stderr)
