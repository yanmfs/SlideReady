# SlideReady

[Português](README.md)

Check a .pptx before you present: fonts that will change, links to local files, media that will not travel and forgotten placeholder text, slide by slide.

![SlideReady](docs/demo.gif)

| Light                                                              | Dark                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| ![SlideReady window, light theme](docs/shots/macos-light-main.png) | ![SlideReady window, dark theme](docs/shots/macos-dark-main.png) |

## Why it exists

Minutes before presenting, the file opens on another computer and the font changed, the video will not play, the link points to the author's desktop and a "Lorem ipsum" is left on slide 12. SlideReady is the check before you step on stage.

## Download

Get the installer from the [Releases](../../releases) page:

- **macOS:** `SlideReady_x.y.z_universal.dmg`
- **Windows:** `SlideReady_x.y.z_x64-setup.exe`

Try it in the browser without installing anything: <https://yanmfs.github.io/slideready/>. The web version cannot tell which fonts are installed, cannot see linked files and does not check links online; the rest of the analysis is the same.

## First launch

The app is not signed with a paid certificate because it is a free personal project, so the system shows a warning the first time.

**macOS:** open the `.dmg`, drag SlideReady to Applications and open it. If the system blocks it, go to System Settings → Privacy & Security and click "Open Anyway". If you see "is damaged", run this in Terminal:

```sh
xattr -cr /Applications/SlideReady.app
```

**Windows:** the installer does not ask for administrator rights. If SmartScreen shows up, click "More info" and then "Run anyway".

## How to use

1. Drop the `.pptx` on the window (from PowerPoint, Keynote or exported from Google Slides) or click Open.
2. Read the summary at the top: errors, warnings and tips.
3. In the Issues tab, filter by severity or category. Each item shows the slide, an explanation and "How to fix" for PowerPoint on Windows, on Mac and in Google Slides.
4. In the Fonts tab, see which fonts the file uses and whether each will change. The Links & media tab lists every link and media file, and the Accessibility tab sums up images without a description, slides without a title and tables.
5. "Save report (HTML)" makes a single file to send to whoever will fix the deck, and "Copy as Markdown" takes the report to an e-mail or chat.
6. If you save the file in PowerPoint while SlideReady is open, the analysis runs again by itself.

Optional: the "Check links online" button (Links & media tab) tests the addresses in the deck. It is the only action in the app that uses the internet, and it runs only when you click.

From a terminal the same analysis runs without the interface: `pnpm build:cli`, then `node dist-cli/slideready.mjs check deck.pptx --json`. The exit code is 1 when there is an error (or a warning, with `--fail-on warning`).

## What it does and does not do

It reads the file in the real slide order, follows layout, master and theme to find the effective text size and font, and applies 23 rules: links to local files, invalid URLs and jumps to missing slides; linked, missing, risky-format or heavy media; fonts that are not embedded and not installed or outside the safe list; placeholder text, small text, text shrunk by autofit and dense slides; images without alt text, slides without a title or with a repeated one, tables without a header; low-contrast text (WCAG); hidden slides, comments, personal names in the file properties, objects outside the slide area and 4:3. The file is never changed.

It does not:

- Render the slides: it estimates sizes and colors inherited from layout, master and theme and, when it cannot resolve one safely, reports nothing. It can miss problems.
- Measure contrast unless text and background are plain colors (no gradient, picture or theme color transform); otherwise it reports nothing. In the link check, sites that refuse automated tests show as "could not confirm", not as broken.
- In the browser demo it cannot tell which fonts are installed or whether linked files exist.

## Privacy

Nothing leaves your computer. The analysis is local and the file is opened read-only. The only network connection is the link check, which you start with a click; it runs outside the webview, which keeps external connections blocked, and sends only the addresses already in the deck.

## Run locally

Requirements: Node.js LTS, pnpm, Rust (stable) and, on macOS, the Xcode Command Line Tools.

```sh
pnpm install
pnpm tauri dev
pnpm test
```

## Roadmap

- Contrast of text over gradients and pictures.
- Publishing the CLI on npm (`npx slideready check`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
