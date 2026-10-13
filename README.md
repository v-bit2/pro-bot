# ⚡ Voltra Mini

A high-performance, modular, multi-session WhatsApp MD bot powered by Node.js and Baileys.

---

## 🌟 Key Features

- **Baileys Pairing Code & QR Authentication**: Simple device linking via phone pairing code or QR scanning.
- **Multi-Session API v1**: Complete REST API for public bot creation, settings management, actions, and deletion.
- **Atomic 3-Bot Maximum Limit**: Per-phone number atomic limit enforcement in MongoDB.
- **Cryptographic Authorization**: 256-bit secure management token issuance with salted SHA-256 hash storage.
- **Voltra Box Formatting**: Recognizable response layout (`┏▣ ◈ *VOLTRA MINI* ◈ ... ┗▣`).
- **Bot Branding Image**: High-resolution dark energy/lightning logo included with `.menu` and bot responses.
- **Self-Chat / "Note to Self" Support**: Full command execution when messaging your own WhatsApp chat.
- **Human-like Presence**: Dynamic typing simulation before sending responses based on message length.
- **Interactive Tic-Tac-Toe**: Fully playable 2-player Tic-Tac-Toe state engine.
- **Textmaker Graphic Engine**: Generate styled graphics for 18 text themes (`.neon`, `.matrix`, `.fire`, `.glitch`, etc.).
- **Persistent Settings Database**: Configurable owner settings (`.setprefix`, `.setbotname`, `.mode`, `.autotyping`, `.autoread`, `.autoreact`, `.setmenuimage`).
- **Group Moderation**: Anti-link protection (`off`, `delete`, `warn`, `kick`), user warnings, custom welcome/goodbye messages.
- **Render Keep-Alive Support**: Integrated endpoint and ping worker to prevent idle sleep on hosting platforms.
- **Responsive Web UI**: Modern, mobile-first Web interface for pairing and monitoring active sessions.

---

## 🔌 REST API v1 Documentation

Voltra Mini provides a complete, rate-limited REST API under `/api/v1` for bot creation, pairing, status monitoring, settings configuration, and session management.

### Authentication
Protected endpoints require a management Bearer token issued during bot creation:
`Authorization: Bearer <managementToken>`

---

### Endpoints Summary

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | No | Public operational service health check |
| `POST` | `/api/v1/bots` | No | Create bot record & receive one-time management token |
| `GET` | `/api/v1/bots` | Bearer Token | List all bots owned by the authenticated user |
| `GET` | `/api/v1/bots/:botId` | Bearer Token | Get detailed bot information & settings |
| `GET` | `/api/v1/bots/:botId/settings` | Bearer Token | Retrieve bot configuration settings |
| `PATCH` | `/api/v1/bots/:botId/settings` | Bearer Token | Update configurable bot settings |
| `POST` | `/api/v1/bots/:botId/pair` | Bearer Token | Initiate code or QR pairing handshake |
| `GET` | `/api/v1/bots/:botId/status` | Bearer Token | Get live lifecycle state & connection status |
| `POST` | `/api/v1/bots/:botId/actions` | Bearer Token | Dispatch connection action (`reconnect`, `disconnect`, `refresh`) |
| `DELETE` | `/api/v1/bots/:botId` | Bearer Token | Permanently delete bot & clean up session state |

---

### Example Request (`POST /api/v1/bots`)

```bash
curl -X POST http://localhost:3000/api/v1/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Voltra Bot",
    "phoneNumber": "263786624966",
    "pairingMethod": "code"
  }'
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "botId": "bot_1a2b3c4d5e6f7a8b9c0d1e2f",
    "name": "My Voltra Bot",
    "phoneNumber": "263786624966",
    "status": "created",
    "managementToken": "3f8b9a1e0c2d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
    "pairingMethod": "code",
    "createdAt": "2025-02-23T10:00:00.000Z"
  },
  "message": "Bot created successfully. Save your management token securely. It will not be shown again."
}
```

---

## 📋 Requirements

- Node.js 20.0.0 or higher
- npm 9+
- WhatsApp account

---

## 🚀 Quick Start

### 1. Installation

```bash
git clone <repo-url>
cd voltra-mini
npm install
```

### 2. Start Bot

```bash
npm start
```

For development auto-reload:

```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## 📱 Pairing a WhatsApp Account

1. Access the web interface at `http://localhost:3000` (or your deployment URL).
2. Enter your WhatsApp phone number with country code (e.g. `263786624966`). Do not use `+`, spaces, or hyphens.
3. Click **Get Pairing Code**.
4. Open WhatsApp on your phone:
   - Go to **Settings** → **Linked Devices**.
   - Tap **Link a Device** → **Link with Phone Number**.
5. Enter the 8-character pairing code shown on the Web UI.

Session files are stored in `sessions/<phone-number>/`.

---

## ⚙️ Environment Variables

You can configure Voltra Mini using environment variables or by editing `config.js`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Web server listening port | `3000` |
| `PREFIX` | Initial command prefix symbol | `.` |
| `OWNER_NUMBER` | Bot owner WhatsApp number (country code, no `+`) | `263786624966` |
| `MAX_SESSIONS` | Maximum simultaneous WhatsApp sessions | `10` |
| `SESSION_DIR` | Directory for storing session credentials | `./sessions` |
| `MONGO_URI` | MongoDB connection URI | `""` |
| `KEEP_ALIVE` | Enable background keep-alive worker | `false` |
| `KEEP_ALIVE_URL` | Endpoint URL to ping for keep-alive | `""` |
| `KEEP_ALIVE_INTERVAL` | Ping interval in milliseconds | `300000` (5m) |
| `TYPING_DELAY_MIN` | Minimum typing delay in ms | `300` |
| `TYPING_DELAY_MAX` | Maximum typing delay in ms | `2500` |
| `LOG_LEVEL` | Pino logger output level | `silent` |

---

## 🤖 Command Suites & Categories

All commands use the configurable prefix (default `.`). Use `.menu <category>` to view specific categories.

### ⚡ General Commands
- `.menu [category]` — Display categorized command list or specific category commands.
- `.ping` — Measure network response latency and process uptime.
- `.alive` — Display online status, system memory, Node/Baileys version, and branding image.
- `.runtime` — Display formatted process uptime.
- `.owner` — Send owner contact card.
- `.about` — Overview of Voltra Mini features.
- `.attp <text>` — Generate animated/colored text sticker.
- `.crop` — Crop quoted/attached image into a 1:1 square.
- `.getpp [@user]` — Get high-resolution profile picture of user/group.
- `.github <user>` — Fetch GitHub profile details and stats.
- `.groupstats` — Display member breakdown and creation date.
- `.list` — Display compact list of categories and total command counts.
- `.myactivity` — Show per-user command usage history and top used commands.
- `.qr <text|url>` — Generate QR code image.
- `.simage` — Convert WhatsApp sticker into a downloadable JPEG image.
- `.ssweb <url>` — Render a screenshot of a webpage.
- `.take <pack>|<author>` — Customize sticker metadata.
- `.tts <text>` — Convert text to voice speech note.
- `.viewonce` — Reveal view-once image/video media.

### 👥 Admin & Moderation Commands
- `.antilink <off|delete|warn|kick>` — Configure link detection mode.
- `.warn @user` — Issue a formal warning to a group member (kicks on 3/3).
- `.resetwarn @user` — Reset warning count for a member.
- `.welcome` — Toggle automatic welcome message for new members.
- `.goodbye` — Toggle automatic goodbye message for leaving members.
- `.setwelcome <text>` — Set custom welcome text with `{user}`, `{group}`, `{count}`.
- `.setgoodbye <text>` — Set custom goodbye text with `{user}`, `{group}`.
- `.hidetag <message>` — Send hidden mention message to all members.
- `.mute` / `.unmute` — Mute/unmute group chat for non-admins.
- `.kick @user` — Remove a member from the group.
- `.promote @user` / `.demote @user` — Change admin status of a member.
- `.tagall` / `.admins` — Mention all members or admins.
- `.groupinfo` / `.groupstatus` — Display group metadata and moderation status.
- `.grouplink` — Get group invite link.
- `.delete` — Delete a quoted message in the group.
- `.clean` — Clean up bot output buffer.
- `.antiaudio` / `.antifile` / `.antisticker` / `.antivideo` — Toggle media filters.

### 👑 Owner Commands
- `.setprefix <prefix>` — Change and persist command prefix.
- `.setbotname <name>` — Change and persist bot name.
- `.setmenuimage` — Set custom bot/menu image by replying to an image.
- `.mode <public|self|private>` — Set operating mode.
- `.autotyping` / `.autoread` / `.autoreact` — Toggle automatic presence/read/reactions.
- `.anticall` / `.antidelete` — Toggle anti-call / anti-delete protection settings.
- `.block @user` / `.unblock @user` — Block/unblock users on WhatsApp.
- `.broadcast <text>` — Send announcement to all joined groups.
- `.restart` — Safely reboot bot process.

### 🎮 Fun & Games
- `.tictactoe @user` — Play interactive 2-player Tic-Tac-Toe (`.ttt <1-9>` to make moves).
- `.joke` / `.meme` / `.memesearch <sub` — Get jokes and trending memes.
- `.compliment` / `.flirt` / `.insult` / `.dare` / `.truth` — Interactive party prompts.
- `.gayrate` / `.ship` — Fun rate meters and love compatibility score.
- `.bomb` / `.pies` — Fun interactive prompts.

### 🎨 Textmaker Graphic Engine
- `.<theme> <text>` — Generate styled text graphics for 18 themes:
  `1917`, `arena`, `blackpink`, `devil`, `fire`, `glitch`, `hacker`, `ice`, `impressive`, `leaves`, `light`, `matrix`, `metallic`, `neon`, `purple`, `sand`, `snow`, `thunder`.

---

## 🌐 Deploying to Render & Keep-Alive Configuration

### Deploying on Render

1. Create a new **Web Service** on Render pointing to your repository.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment Variables:
   - `KEEP_ALIVE`: `true`
   - `KEEP_ALIVE_URL`: `https://your-app-name.onrender.com/api/health`
   - `KEEP_ALIVE_INTERVAL`: `300000`

---

## 🔒 Security & Session Isolation

- **Authentication Security**: The `sessions/` directory contains sensitive WhatsApp security tokens. Never commit `sessions/` or expose session credentials through static routes or API endpoints.
- **Session Isolation**: Each connected socket manages its own credentials, command execution context, and reconnection loop. Sessions cannot cross-talk or execute commands on behalf of other connected accounts.

---

## 📄 License

MIT License. Built with ❤️ for the Baileys developer community.
