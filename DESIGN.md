---
name: Blackjack Guide
description: Exact composition-dependent EV for every blackjack action, printed in the language of the deck.
colors:
  felt-950: "#08231a"
  felt-900: "#0b2c20"
  felt-800: "#0f3b2a"
  felt-700: "#14533b"
  felt-line: "#2a6a50"
  felt-ink: "#b4cfc1"
  ink-950: "#0e1114"
  ink-900: "#14181c"
  ink-850: "#191e23"
  ink-800: "#20262c"
  ink-700: "#2c333b"
  ink-600: "#3a424b"
  text: "#e9e4d8"
  mute: "#a0a8b0"
  faint: "#78818a"
  paper: "#f2ead9"
  paper-bright: "#fff7e6"
  paper-edge: "#d6cab0"
  paper-ink: "#16191c"
  paper-mute: "#5d5648"
  pip: "#c8102e"
  cut: "#e0263f"
  pos: "#86dcab"
  neg: "#f39494"
  push: "#a0a8b0"
  warn: "#e8b45a"
  card-back: "#7d1020"
  card-back-diamond: "#921728"
typography:
  index:
    fontFamily: "'Bodoni Moda Variable', 'Bodoni 72', Didot, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  body:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
    fontFeature: "tnum"
  label:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.06em"
    fontFeature: "tnum"
  figure:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    fontFeature: "tnum"
rounded:
  xs: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  full: "9999px"
spacing:
  hairline: "1px"
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.5rem"
components:
  button:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.5rem"
  button-hover:
    backgroundColor: "{colors.ink-850}"
  button-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.5rem"
  button-paper-hover:
    backgroundColor: "{colors.paper-bright}"
  segmented:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.mute}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "0.375rem"
    padding: "6px 12px"
  select:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.5rem"
  chip-target:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip-target-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.full}"
  action-row:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  action-row-best:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  panel-card:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "14px"
  dialog:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
  playing-card-md:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    width: "3.75rem"
  kbd:
    textColor: "{colors.mute}"
    rounded: "{rounded.xs}"
    padding: "0.2rem 0.35rem"
---

# Design System: Blackjack Guide

## Overview

**Creative North Star: "Pip & Index"**

The table speaks the language of the printed deck: two inks on ivory card stock. Everything that is chrome lives in card-back ink, a near-black slate with hairline rules; the green felt exists only where the table is; and ivory card stock is a scarce material reserved for real cards and for the single thing the engine recommends. The max-EV action is the only card turned face up. The system refuses the category default of a slate dashboard with a blue accent on every highlight: there is no blue, and no accent hue is used to mean "selected".

Density is operational, not decorative. One workhorse sans (Geist) with tabular figures carries every word and number, so EVs and percentages align in columns and 0,1 % differences are legible. The one display voice is Bodoni Moda, and it is confined to what a deck prints in Bodoni-like faces: card corner indices, court letters, and the action key index (H, S, D, P, R). Every probability sits on a fixed 0–100 % scale, so bars in different panels are comparable at a glance.

Motion is physical and tied to the deck: a dealt card slides in from the shoe corner, the hole card flips on reveal, the recommended row flips face up when the engine's best action changes, and stale numbers dim in place rather than disappearing. All of it respects reduced motion.

**Key Characteristics:**
- Three materials, three jobs: felt for the table, ink for panels, ivory paper for cards and the single recommendation.
- Two inks on paper: paper-ink black and pip red, as on a printed card.
- Tabular Geist for all UI and data; Bodoni Moda only for indices.
- Signed EV in mint/rose, always with sign and number; color is never the only signal.
- One fixed probability scale across every bar and meter.
- Depth only where a physical object would cast it: cards, the face-up row, floating layers.

## Colors

A dark, near-monochrome ink field with a green felt stage, warm ivory as the scarce highlight material, and a card-red reserved for suits and danger.

### Primary
- **Ivory Card Stock** (`paper`): the face of every playing card, the recommended action row, the recommended action button, the selected segment of a segmented control, the selected target chip, text selection and the focus ring. Its scarcity is what makes "face up" mean "recommended".
- **Card Red** (`pip`): red suits and red court letters on paper, the key index of the recommended row, the brand mark's "A", and the bust total badge.

### Secondary
- **Felt Green** (`felt-800`, with `felt-700` as the radial light pool and `felt-950`/`felt-900` as the deep shade): the table surface only. `felt-line` draws dashed empty card slots; `felt-ink` is the pale green used for hand labels and phase text on the felt.

### Tertiary
- **Cut-Card Red** (`cut`): the cut-card mark on the shoe gauge and the fill of the bust meter: risk and penetration.
- **EV Mint** (`pos`) and **EV Rose** (`neg`): positive and negative EV figures and the win/lose segments of probability bars. Always paired with a signed number. `push` (cool grey) is the push segment.
- **Amber Notice** (`warn`): "Calculando…" status and the "≈ aproximado" badge.

### Neutral
- **Card-Back Ink** (`ink-900`): page body and the analysis panel. `ink-950` is the deepest well (header, buttons, inputs, inset cards); `ink-850` is button hover and skeletons; `ink-800` is hairline rules and bar tracks; `ink-700` is control borders; `ink-600` is hover borders, kbd outlines and scale midlines.
- **Warm Text** (`text`): primary text on ink, a slightly warm off-white that rhymes with paper. `mute` for secondary text, `faint` for tertiary (non-recommended key indices, engine timing).
- **Paper Inks** (`paper-ink`, `paper-mute`, `paper-edge`): text, secondary text and the bottom-edge line on any ivory surface. `paper-bright` is the hover lift of an ivory button.
- **Card Back** (`card-back`, `card-back-diamond`): the two-red diamond lattice of a face-down card, framed by a 5px paper border.

### Named Rules
**The Face-Up Rule.** Ivory paper is reserved for real cards (including the card picker's rank keys), the single recommended action (row and button), and the current selection in a segmented control or target chip group. Nothing else is filled with paper; a second ivory element on screen dilutes the recommendation.

**The Felt Stays on the Table Rule.** Felt green appears only on the table section. Panels, header and dialogs are ink.

**The Signed Number Rule.** `pos` and `neg` never appear without a signed figure beside them ("+3,45 %", "−1,20 %"); bars always carry their percentages in text below.

## Typography

**Body Font:** Geist Variable (with ui-sans-serif, system-ui)
**Index Font:** Bodoni Moda Variable (with Bodoni 72, Didot, serif)

**Character:** A neutral, technical sans for an instrument panel, set with tabular figures globally (`font-variant-numeric: tabular-nums` on `:root`), against a high-contrast Didone that appears only where a printed deck would use it.

### Hierarchy
- **Index** (Bodoni Moda 600, 1.25rem in action rows; scales with card size via `--card-index` 0.7–1.35rem and `--card-court` 1.25–3rem; line-height 1): card corner indices, court letters, action key letters H/S/D/P/R, rank buttons in the card picker, the brand mark.
- **Headline** (Geist 600, 1.75rem, line-height 1): the single headline figure of a meter (bust probability).
- **Title** (Geist 600, 1.125rem, tight): EV figures in action rows (right-aligned) and dialog titles (with -0.01em tracking).
- **Body** (Geist 500, 0.875rem): buttons, controls, panel copy; 13px in compact controls (segmented, action buttons on phone, shoe HUD).
- **Label** (Geist 600, 0.75rem, 0.06em tracking, uppercase, `mute`): section headings of analysis panels and fieldset legends. These are the headings themselves, not eyebrows above another heading.
- **Figure** (Geist 500, 0.75rem): win/push/lose percentages under bars, badges at 11px.

### Named Rules
**The Index Only Rule.** Bodoni Moda is used for single characters and short indices only (card ranks, action keys). Never for headings, labels, sentences or numbers that are data.

**The Tabular Rule.** All figures are tabular, two decimals, Spanish decimal comma, sign on EV. Never round a probability to an integer.

## Layout

App shell: a sticky header (56px tall from `lg`, wrapping to two rows below it) in `ink-950` at 95 % with a light backdrop blur and a hairline `ink-800` bottom rule. Below it, a two-column grid from `lg` (1024px): the felt table fills `minmax(0, 1fr)` on the left, and a fixed 27.5rem (440px) analysis panel on the right, separated by a hairline left rule and scrolling independently. Below `lg` the panel stacks under the table with a hairline top rule. The app is usable from 360px.

The table is a vertical column, centred: dealer hand at the top, other seats in the middle, the player's hands and then the action bar pushed to the bottom (`mt-auto` on desktop). Action buttons form a 3-column grid on narrow phones, 5 columns from 400px, and a wrapped row from 640px. The card picker is a 7-column rank grid on phones and 13 columns from 640px.

Spacing rhythm is tight and in 0.25rem steps: 6px (`xs`) between bar and figures and between action buttons on phone; 8px (`sm`) between rows and controls; 12–14px (`md`) row padding; 20–24px (`lg`/`xl`) section and panel padding. Breakpoints are Tailwind's defaults (640 / 768 / 1024 / 1280px); card sizes step at 640 and 1280.

## Elevation & Depth

A hybrid: chrome is flat and separated by hairline rules and tonal steps of ink (950 / 900 / 850 / 800); real shadow is reserved for objects that would physically lift: cards, the face-up recommended row, and floating layers (card picker tray, tooltip, notice, dialog).

### Shadow Vocabulary
- **Card stock** (`box-shadow: 0 1px 0 var(--color-paper-edge), 0 8px 18px rgb(0 0 0 / 0.35)`): every playing card face and back. The 1px paper-edge line reads as the thickness of the card.
- **Face-up row** (`box-shadow: 0 1px 0 var(--color-paper-edge), 0 10px 24px rgb(0 0 0 / 0.3)`): the recommended action row.
- **Rank key** (`box-shadow: 0 1px 0 var(--color-paper-edge)`): ivory rank buttons in the card picker; removed when disabled.
- **Tray** (`box-shadow: 0 12px 32px rgb(0 0 0 / 0.35)`): card picker floating over the felt.
- **Popover** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.45)`): tooltips.
- **Notice** (`box-shadow: 0 12px 32px rgb(0 0 0 / 0.5)`): transient notices.
- **Modal** (`box-shadow: 0 24px 64px rgb(0 0 0 / 0.55)`): dialogs, over an `ink-950` 70 % backdrop.
- **Active hand** (`box-shadow: inset 0 0 0 1px var(--color-paper)`): a 1px ivory inner ring around the active split hand on a darkened felt wash.

### Named Rules
**The Paper Casts Shadow Rule.** Only ivory objects and floating layers carry a drop shadow. Ink panels, rows and cards at rest are flat, divided by 1px rules.

## Shapes

Softly rounded, small radii tied to card proportions. Cards are 5:7 with corner radius that scales with size (0.3–0.6rem). Controls and buttons use 0.5rem; rows, inset cards and hand frames 0.75rem; floating trays and dialogs 1rem; badges, chips, bars and meters are fully round. Kbd keys use 0.25rem. Borders are always 1px hairlines (`ink-800` for structure, `ink-700` for controls); dashed hairlines mark empty states and empty card slots. The one exception is the card back's 5px ivory frame, the printed white border of a real card.

## Components

### Buttons
Ink keys with a hairline, a press that gives.
- **Shape:** gently rounded (0.5rem), minimum height 2.5rem (2.75rem for action buttons on phone; 2.25rem for compact header icon buttons).
- **Default:** `ink-950` fill, `ink-700` hairline, `text` label, Geist 500 at 0.875rem, optional Lucide icon at 16px.
- **Hover (fine pointer only):** border to `ink-600`, fill to `ink-850`, 160ms.
- **Active:** `scale(0.97)` over 140ms with the out-expo ease.
- **Disabled:** 40 % opacity, not-allowed cursor.
- **Paper (recommended):** ivory fill and border, `paper-ink` label, kbd outlined in `paper-edge`; hover lifts to `paper-bright`. Only the engine's max-EV legal action gets it.
- **Key hint:** each action button carries its key in a small outlined kbd (0.6875rem, 600) from 640px.

### Segmented control
- **Style:** `ink-950` track with `ink-700` hairline and 2px inset; options are 13px Geist 500 in `mute`.
- **State:** the selected option is an ivory chip (`paper` / `paper-ink`); hover lifts text to `text`. It is a radiogroup with a paper focus outline.

### Chips
- **Target chips** (card picker "Va a"): fully round, `ink-700` hairline, `mute` text; selected becomes ivory with `paper-ink` text.
- **Badges:** fully round 11px 600; "Recomendada" is `paper-ink` on paper; "≈ aproximado" is an amber-outlined badge on ink and a `paper-mute` outlined badge on paper. Hand totals are felt-dark pills; a bust total is a `pip` pill with white text.

### Cards / Containers
- **Corner Style:** 0.75rem for inset cards and rows, 1rem for trays and dialogs.
- **Background:** `ink-950` inset wells on the `ink-900` panel; `ink-900` rows.
- **Shadow Strategy:** flat at rest (see Elevation).
- **Border:** 1px `ink-800`; dividers between grouped figures (`divide-ink-800`).
- **Internal Padding:** 12–16px.
- **Empty / error:** dashed `ink-700` border with `mute` copy; errors use a `neg` lead line and a retry button.

### Inputs / Fields
- **Select:** 2.5rem tall, 0.5rem radius, `ink-950` fill, `ink-700` hairline, 0.875rem text; disabled at 45 % opacity.
- **Focus (global):** 2px solid ivory outline with 2px offset.

### Navigation
The header is the only navigation: brand (a tiny ivory card with a red Bodoni "A" plus "Blackjack Guide" at 15px 600), two segmented controls (Jugador/Dealer, Simulación/Manual), the rules summary button and the shoe HUD, ending with an icon-only reshuffle button. On phones the segmented controls drop to their own full-width row.

### Playing Card (signature)
A 5:7 ivory card in two inks: Bodoni corner indices top-left and rotated bottom-right, a centred suit pip (or Bodoni court letter for J/Q/K), red suits in `pip`, black in `paper-ink`. Sizes: `md` 3.75rem → 5.25rem (640px) → 6rem (1280px); `sm` 2.6rem → 3.25rem. Face-down cards show the two-red diamond lattice inside a 5px ivory frame. Dealt cards slide in from the upper right (`translate(36px,-28px) rotate(5deg)` → rest, 240ms); the hole card flips on `rotateY` over 320ms. Overlapping hands fan at 42 % of card width. Empty slots are dashed `felt-line` outlines with `felt-ink` labels.

### Action Row (signature)
One row per legal action, sorted by EV: Bodoni key index, action name, signed EV right-aligned (Title role), and a win/push/lose probability bar with figures beneath. Non-recommended rows are flat `ink-900` with an `ink-800` hairline and EV in mint or rose. The best row is ivory card stock with a red key index, `paper-ink` EV and a "Recomendada" badge; when the engine's best action changes, it flips face up (`rotateX(-70deg)` → 0, 340ms, top-hinged; opacity-only under reduced motion).

### Probability Bar and Meters
A 6px fully round track (`ink-800`, or `paper-edge` at 60 % on paper) holding stacked win (`pos`) / push (`push` 70 %) / lose (`neg`) segments on a fixed 0–100 % scale, with dot-swatched figures underneath. The bust meter is an 8px track with a `cut` fill and a 50 % midline in `ink-600`, headed by a 1.75rem figure. The shoe gauge is a 2px-tall track with a `mute` dealt fill and a 3px `cut` cut-card mark at the configured penetration.

### Stale state
While recalculating or after inputs change, results stay in place at 40 % opacity and half saturation (200ms), non-interactive and hidden from assistive tech, with an amber "Calculando…" status; skeletons are pulsing `ink-850` 4rem rows.

## Do's and Don'ts

### Do:
- **Do** reserve ivory (`paper`) for real cards and rank keys, the single max-EV action (row and button), and the current option of a segmented control or chip group.
- **Do** set every number in Geist with tabular figures, two decimals, Spanish decimal comma, and a sign on EV.
- **Do** pair every `pos`/`neg` color with its signed figure and every bar with its percentages in text.
- **Do** draw all probabilities on the same fixed 0–100 % scale.
- **Do** use Bodoni Moda only for card indices, court letters and action key letters.
- **Do** separate ink surfaces with 1px `ink-800` / `ink-700` hairlines and tonal steps, and keep drop shadow for paper objects and floating layers.
- **Do** dim stale results in place (40 % opacity, half saturation) instead of removing them.
- **Do** gate hover styles behind `(hover: hover) and (pointer: fine)` and respect reduced motion on every flip and slide.

### Don't:
- **Don't** introduce a blue or any other accent hue for selection or highlight; selection is ivory, recommendation is ivory.
- **Don't** fill a second element with paper on the same screen as the recommendation unless it is a card, a rank key, or the current option of a selection group.
- **Don't** use felt green outside the table section.
- **Don't** use `pip`/`cut` red for anything except red suits, the brand mark, the cut card, bust, and the recommended key index.
- **Don't** set headings, sentences or data figures in Bodoni Moda.
- **Don't** round probabilities to integers or show EV without its sign.
