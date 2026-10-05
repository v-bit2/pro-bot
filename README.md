# ⚡ Voltra Mini

A high-performance, modular, multi-session WhatsApp MD bot powered by Node.js and Baileys.

---

## 🌟 Key Features

- **Baileys Pairing Code Authentication**: Simple pairing without QR code scanning.
- **Multi-Session Support**: Run multiple WhatsApp accounts isolated in a single bot instance.
- **Self-Chat / "Note to Self" Support**: Full command execution when messaging your own WhatsApp chat.
- **Human-like Presence**: Dynamic typing simulation before sending responses based on message length.
- **Modular Command System**: Automatic loading of commands with error handling, categories, and aliases.
- **Render Keep-Alive Support**: Integrated endpoint and ping worker to keep services alive on hosting platforms.
- **Responsive Web UI**: Modern, mobile-first Web interface for pairing and monitoring active sessions.

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
| `PREFIX` | Command prefix symbol | `.` |
| `OWNER_NUMBER` | Bot owner WhatsApp number (country code, no `+`) | `263786624966` |
| `MAX_SESSIONS` | Maximum simultaneous WhatsApp sessions | `10` |
| `SESSION_DIR` | Directory for storing session credentials | `./sessions` |
| `KEEP_ALIVE` | Enable background keep-alive worker | `false` |
| `KEEP_ALIVE_URL` | Endpoint URL to ping for keep-alive | `""` |
| `KEEP_ALIVE_INTERVAL` | Ping interval in milliseconds | `300000` (5m) |
| `TYPING_DELAY_MIN` | Minimum typing delay in ms | `300` |
| `TYPING_DELAY_MAX` | Maximum typing delay in ms | `2500` |
| `LOG_LEVEL` | Pino logger output level | `silent` |

---

## 🤖 Available Commands

All commands use the configurable prefix (default `.`).

### ⚡ General Commands
- `.menu` / `.help` — Display categorized list of commands.
- `.ping` — Measure network latency and process uptime.
- `.alive` — Display online status, memory usage, runtime metrics, and Baileys version.
- `.runtime` — Display formatted process uptime.
- `.owner` — Send owner contact card.
- `.about` — Overview of Voltra Mini features.

### 🖥️ System Commands
- `.system` — Display host OS, CPU core count, memory usage, and Node.js details.

### 👥 Group Commands
- `.tagall` — Mention all group members (`.tagall <message>`).
- `.admins` — List and mention group administrators.
- `.groupinfo` — Show group metadata, member count, creation date, and description.
- `.mention` — Send an announcement mentioning all participants.
- `.kick` — Remove mentioned user or quoted sender (Requires Bot Admin & User Admin).
- `.promote` — Promote member to administrator (Requires Bot Admin & User Admin).
- `.demote` — Demote administrator to member (Requires Bot Admin & User Admin).

### 🎨 Media Commands
- `.sticker` / `.s` — Convert quoted or attached image, GIF, or video into a WhatsApp sticker.

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

### 💡 Note on Free-Tier Hosting & Keep-Alive

Application-level self-ping requests help prevent idle sleep on some cloud providers, but **they do not guarantee that hosting providers (such as Render) will keep free-tier instances awake indefinitely** if provider policies strictly enforce sleep periods after periods of inactivity or monthly quota limits.

---

## 🔒 Security & Session Isolation

- **Authentication Data Security**: The `sessions/` directory contains sensitive WhatsApp security tokens. Never commit `sessions/` or expose session credentials through static routes or API endpoints.
- **Session Isolation**: Each connected socket manages its own credentials, command execution context, and reconnection loop. Sessions cannot cross-talk or execute commands on behalf of other connected accounts.

---

## 🔧 Troubleshooting

- **Pairing code expires or fails**: Ensure the phone number includes the country code without leading `+` or zero. Ensure your server can reach WhatsApp Web servers.
- **Bot doesn't respond in Self Chat**: Ensure your command prefix matches `PREFIX`.
- **Media sticker conversion error**: Ensure input file is under 10MB and valid image/video format.

---

## 📄 License

MIT License. Built with ❤️ for the Baileys developer community.
