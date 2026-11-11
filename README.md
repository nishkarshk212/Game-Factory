# Game-Factory — GameVerse – Sonic Network

**GameVerse | Powered by Sonic Network** is a full-stack, real-time 2-player Telegram Mini Web App gaming platform built with React, TypeScript, Tailwind CSS, Express, Socket.IO, Redis, and PostgreSQL.

## Game Library (14 Real-Time 2-Player Games)
1. **Chess** — Full classical rules (castling, en passant, promotion, check/checkmate, stalemate, threefold repetition, 50-move, insufficient material)
2. **Ludo** — 2-player opposite-corner cross-track with server RNG dice, safe stars, captures, 3-sixes forfeit & exact home finish
3. **Carrom** — Server-authoritative 2D physics simulation, striker positioning, White/Black coins, Red Queen & cover rule
4. **8 Ball Pool** — Server-authoritative 2D physics simulation with break shot, open table, solids/stripes, fouls & ball-in-hand
5. **Sudoku Duel** — Unique-solution 9×9 competitive duel with turn scoring, streaks & 3-strike loss rule
6. **Checkers** — 8×8 American Checkers with mandatory captures, chained multi-jumps & King promotions
7. **Battleship** — Secret 10×10 fleet deployment + naval combat with zero state leaks
8. **Connect Four** — 7×6 vertical gravity disc duel
9. **Four in a Row (Pop-Out)** — 8×7 grid supporting top drop AND bottom-row own-disc pop-out
10. **Dots and Boxes** — 5×5 dots / 4×4 territory boxes with bonus turns on capture
11. **Tic-Tac-Toe** — Best-of-3 rounds with alternating starting symbol
12. **Rock Paper Scissors** — Simultaneous secret-commit Best of 5 (anti-peek server reveal)
13. **Reversi (Othello)** — 8×8 territory flipping with automatic turn skip
14. **Memory Clash** — 6×4 server-hidden cyber pairs duel

## Architecture
- `shared/` — Shared TypeScript types, 14-game catalog metadata, and XP rank progression logic
- `server/` — Express REST API, Socket.IO real-time coordinator, Telegram HMAC-SHA256 `initData` authentication, PostgreSQL repository/migrations, Redis matchmaking queues & match state sync, and 14 server-authoritative game engines
- `client/` — Mobile-first React + Vite + Tailwind CSS Telegram Mini App UI with Web Audio SFX, Telegram Haptics/Vibration, Dark/Light theme, Social Hub, Leaderboards, Daily Challenges, Achievements, and Admin Console

## Quick Start (Local Development)

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure PostgreSQL 15+ and Redis 7+ are running (or run `docker compose up -d postgres redis`).
4. Run database migrations & start dev servers:
   ```bash
   npm run db:migrate
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend + Socket.IO: `http://localhost:3001`

## Production Deployment (Docker Compose)
```bash
TELEGRAM_BOT_TOKEN=your_bot_token JWT_SECRET=your_secret docker compose up --build -d
```

## Telegram BotFather Setup
1. Open [@BotFather](https://t.me/BotFather) on Telegram and run `/newbot` (or select an existing bot).
2. Copy your Bot Token into `TELEGRAM_BOT_TOKEN` in `.env`.
3. Run `/newapp` in `@BotFather`, select your bot, set short name (`gameverse`), and enter your HTTPS deployment URL (`https://your-domain.com`).
4. Invite links automatically generate `https://t.me/<TELEGRAM_BOT_USERNAME>/<TELEGRAM_MINI_APP_SHORT_NAME>?startapp=<ROOM_CODE>` so tapping a friend's invite opens directly into the room!

## Running Tests
```bash
npm run typecheck
npm test
```

