# Mobile Sentrix Price Tool

A Chrome extension that turns a parts supplier's catalog into a repair quoting
tool. Built for the phone repair shop I work at — **it's used on the floor every
single day at our franchise.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/mobile-sentrix-cpr-repair/fmhfclkjnbjndcidfojhdomlnpljaekf)

---

## The Problem

Mobile Sentrix lists part costs. It does not list what to *charge*. Every quote
meant a technician opening a calculator, adding labor, and doing the same
arithmetic dozens of times a day — with the usual result that two techs quoted
two different prices for the same repair.

This extension does that math inline, on the page, consistently.

## Features

### Repair Price Table Injection
For every product price on the page, the extension injects a compact breakdown:

| Row | Meaning |
|---|---|
| **Part Price** | Scraped from the page |
| **Labor** | Your configured labor rate |
| **Repair Price** | What the customer pays |

### Floating Repair Calculator
A persistent cart that follows you across the catalog. Add parts as you browse,
and it totals the full repair — parts plus labor — without leaving the page.

### Customizable Labor Values
Labor rates are configurable, so the tool matches your shop's pricing instead of
a hardcoded guess. Change it once, every price on the page updates.

### Per-Device Notes
An optional notes field that **auto-saves per device**. Jot down a quirk with a
particular model — a screwed-down connector, a known-bad aftermarket part — and
it's there next time anyone on the team looks that device up.

## Installation

**From the Chrome Web Store** (recommended):

[Install here →](https://chromewebstore.google.com/detail/mobile-sentrix-cpr-repair/fmhfclkjnbjndcidfojhdomlnpljaekf)

**From source** (for development):

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder

## How It Works

The extension runs a content script against Mobile Sentrix product pages. It
finds price elements in the DOM, computes the repair price from the configured
labor value, and injects the breakdown table next to each one. The calculator
cart and device notes persist in Chrome's storage, so state survives navigation
and browser restarts.

## Tech Stack

- **JavaScript** — no framework, no build step
- **Chrome Extension Manifest V3**
- **Content scripts** for DOM injection
- **Chrome Storage API** for persisting labor rates, cart, and notes

## Project Structure

```
├── manifest.json    Extension manifest (MV3)
├── src/             Core logic
├── content/         Content scripts injected into pages
└── icons/           Extension icons
```

## Status

In active production use. Feature requests come from actual technicians, which
has been the most useful source of direction I've had on any project.

## License

MIT
