# TETRIS NEON

2D neon Tetris: single player (offline), online 2-player (random match or private room),
same-phone 2-player, levels with a smooth speed ramp, 7 colour palettes, powers and a coin store.
Installable as a phone app (PWA).

## Modes
- **Single player** - no internet needed. Beats your own best score.
- **Find a random player** - matches anyone searching at the same time.
- **Create private room** - 4-letter code; your friend taps Join and types it.
- **2 players on this device** - split keyboard on one screen.

## Levels, speed and colours
Level rises with lines and score; gravity gets slightly faster each level.
Palettes unlock by score: NEON 0, AURORA 1200, CANDY 3000, EMBER 6000, ICE 10000, VOID 16000, GOLD 24000.

## Powers
| Power | Charge | Effect |
|---|---|---|
| HOLD | free, 1x per piece | park the current piece |
| SLOW-MO | 35 | gravity 2.3x slower for 12s |
| PACK | 45 | collapse all gaps, clear full rows |
| BOMB | 55 | remove the bottom 2 rows |
| ATTACK | 70 | 2 junk rows to the rival (x2 score in solo) |

The meter fills +16 per line, +12 tetris bonus, +2 per piece locked.
Keys: C hold, 1 slow, 2 bomb, 3 pack, 4 attack/x2, P pause, M music. The number under each power button is how many you own; it drops by 1 each time you use one, and you refill it from the Store with coins.

## Store and coins
Coins earned per run: **score / 20**, **+5 per level reached**, **+1 per 2 lines**, **+100 for winning a match**.
New players start with **80 coins**.

Prices: Slow-mo 15, Pack 18, Bomb 22, Attack 28. Buy x3 for a ~20% discount, or the
Starter bundle (60) for 2 of every power. Max 9 of each power in the bag.

Bought powers are used **before** the charge meter, in every mode. Using one drops the
count immediately and the remaining count is saved to the device, so your next game shows
exactly what is left.

## Sound & music
Music and all effects are synthesised in the browser - no audio downloads, works offline.
Toggle from the menu (Music / Sound) or the music button in-game, or press M.

## Host it (needed for online play + install)
- **Netlify Drop**: app.netlify.com/drop - drag this folder in, get an https link.
- **GitHub Pages**: push the files, Settings - Pages - main / root.
- **Vercel**: `npx vercel deploy`.
- Local test only: `python3 -m http.server 8080` then open http://localhost:8080

## Install on a phone
- Android Chrome: open the link - menu - **Install app**.
- iPhone Safari: open the link - Share - **Add to Home Screen**.
After one online visit the game also works offline (service worker cache).
