# ⚡ Voltra Mini

A high-performance, modular, multi-session WhatsApp MD bot powered by Node.js and Baileys.

---

## 🌟 Key Features

- **Baileys Pairing Code Authentication**: Simple pairing with phone number without scanning QR codes.
- **Multi-Session Support**: Run multiple WhatsApp accounts in an isolated single bot instance.
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
