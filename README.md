# CodeCamo

A listening-practice player that looks like a code editor. Paste a YouTube link, keep the video hidden, and just listen.
Static site, no build step, no dependencies.

## Run locally

Any static server works, for example:

```bash
npx serve .
```

The page must be served over `http://localhost` or `https` (YouTube's player does not work from `file://`).

## Deploy to Vercel

Option A, CLI:

```bash
npm i -g vercel
vercel --prod
```

Option B, dashboard: push this folder to GitHub, then "Add New Project" and import it.
Framework preset: **Other**. Build command: empty. Output directory: `.` (root).

## Use

Open the command palette with `Ctrl+P` and paste a YouTube link, or type in the terminal: `play <url>`.

| Key | Action |
|---|---|
| `F5` / `Space` | pause / continue |
| `Left` / `Right` | back / forward 5 seconds |
| `L` | loop: press once for A, again for B, again to clear |
| `[` / `]` | slower / faster |
| `Up` / `Down` | volume |
| `Alt+P` | peek: small video panel |
| `Alt+F` | full screen video |
| `Esc Esc` | hide the video at once (stealth) |
| `Ctrl+P` | command palette / paste link |
| ``Ctrl+` `` | focus terminal |

Terminal commands: `help`, `play`, `pause`, `resume`, `seek`, `speed`, `loop`, `cc`, `mode`, `note`, `notes`, `history`, `clear`.

Notes and history are kept in your browser (`localStorage`), shown as `notes.md` and `history.json`.

## Notes

- Some videos block embedding; the editor shows an error notification for those.
- Keep the tab in the foreground on mobile: browsers may pause hidden media when the screen locks.
