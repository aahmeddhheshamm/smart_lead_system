# Local n8n

## Run with Docker

```bash
ngrok http 5678                        # note the https://….ngrok-free.app URL
cp n8n/.env.example n8n/.env           # set WEBHOOK_URL to that URL (trailing slash)
docker compose -f n8n/docker-compose.yml up -d
```

Open n8n at your ngrok URL. The Telegram Trigger node's webhook URL must start with that `https://…ngrok-free.app` address.

## Run with npm

```bash
# Windows CMD
set WEBHOOK_URL=https://your-n8n.ngrok-free.app/
n8n start

# PowerShell
$env:WEBHOOK_URL="https://your-n8n.ngrok-free.app/"; n8n start

# macOS / Linux
WEBHOOK_URL=https://your-n8n.ngrok-free.app/ n8n start
```

## Troubleshooting

**`Bad Request: bad webhook: An HTTPS URL must be provided for webhook`** (Telegram Trigger)
n8n doesn't know its public URL and registers `http://localhost:5678/…` with Telegram. Set `WEBHOOK_URL` to the ngrok HTTPS address and restart n8n (the variable is only read at startup).

- Free ngrok gives a new address on every restart, so `WEBHOOK_URL` must be updated each time. A free static ngrok domain avoids this.
- Telegram allows one webhook per bot. If testing still fails, make sure the same workflow isn't also active/published with another URL, and don't use the bot in two n8n instances.
