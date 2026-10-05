# ⚡ Voltra Mini

A lightweight multi-session WhatsApp MD bot powered by Baileys.

## Requirements

- Node.js 20+
- A WhatsApp account
- A server/PC/Termux environment capable of running Node.js

## Install

```bash
npm install
```

## Start

```bash
npm start
```

Open:

```text
http://localhost:3000
```

For a hosted deployment, use the URL/port supplied by your hosting provider.

## Pair a WhatsApp account

1. Open the Voltra Mini web page.
2. Enter the WhatsApp number with country code.
3. Press **Get Pairing Code**.
4. On WhatsApp open **Linked Devices**.
5. Choose **Link a device** and then **Link with phone number**.
6. Enter the displayed code.

The authentication files are stored in `sessions/<number>/`.

## Commands

```text
.menu
.ping
.alive
.owner
```

## Configuration

Edit `config.js`:

```js
export default {
  name: "Voltra Mini",
  owner: "263786624966",
  prefix: ".",
  port: Number(process.env.PORT || 3000),
  maxSessions: Number(process.env.MAX_SESSIONS || 10),
  sessionDir: "./sessions"
};
```

## Environment variables

```text
PORT=3000
MAX_SESSIONS=10
LOG_LEVEL=silent
PUBLIC_BASE_URL=https://your-domain.example
```

## Important

The `sessions/` directory contains authentication credentials for linked WhatsApp accounts. Never publish or share it.

This project uses Baileys, an unofficial WhatsApp Web library. Use it responsibly and comply with WhatsApp's terms and applicable laws.
