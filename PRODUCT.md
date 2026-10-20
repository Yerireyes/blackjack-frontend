# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Analytical blackjack players who both practice (simulation mode) and analyze real situations (manual mode, entering the cards they see at a real table). They use it on desktop and on phones about equally; on a phone it is often consulted next to a real table, so entry must be fast and legible at arm's length.

## Product Purpose

Blackjack Guide shows, for every hand, the exact expected value (EV) and the win/push/lose probabilities of each action (hit, stand, double, split, surrender), computed from the real composition of the cards left in the shoe. It has two modes on the same table: Player (recommends the max-EV action) and Dealer (how the dealer's hand will end and the house edge for the round). Success: the user understands _why_ one action beats another, with numbers they can trust.

## Positioning

Composition-dependent and exact: every number comes from a Rust engine (WebAssembly, in a Web Worker) that recurses over the actual remaining shoe. There are no basic-strategy tables anywhere as a source of decisions. A neighbouring trainer with a static strategy chart cannot truthfully claim this.

## Operating Context

- Simulation: the app deals from a crypto-shuffled virtual shoe, reshuffling at the configured penetration; 0–6 bot seats play the engine's max-EV action.
- Manual analysis: 13-rank picker, each card assigned to player, dealer, another hand or discard; ShoeEditor corrects remaining counts.
- Rules presets: Las Vegas, Europe (no hole card), 6:5.
- Engine package `@bj/engine-wasm` from ../Backend; contract types generated from Rust.

## Capabilities and Constraints

- Golden rule: the frontend never computes or hard-codes a probability or EV. Recommended action is always the max-EV one, never max win %. Approximate values (some split EVs) are marked as such.
- Every visible card is removed from the shoe before a calculation; the dealer's hole card only when revealed.
- Any change to cards or rules invalidates previous results; stale numbers are never presented as current (dimmed with an indicator while recalculating).
- Number format: Spanish decimal comma, two decimals, sign on EV ("+3,45 %", "42,17 %"). Never rounded to integers.
- Keyboard shortcuts on desktop: H hit, S stand, D double, P split, R surrender.
- Responsive from 360 px wide.
- Out of scope for now: remote API mode, accounts and saved sessions, insurance.

## Brand Commitments

- Name: **Blackjack Guide**. No logo yet.
- Voice: precise and didactic. Explains the why with numbers; no casino hype, no promises of winning money. UI copy in Spanish.
- From the architecture doc: dark theme with green felt; neutral panels so numbers read well; positive EV green / negative red, always with sign and number (color is never the only signal).

## Evidence on Hand

- Engine validated against Wizard of Odds dealer tables (16 tables) and 10M-hand Monte Carlo runs (see ../Backend/README.md). No testimonials, users or press exist; none may be fabricated.

## Product Principles

1. The engine is the only source of numbers; the UI is an honest window onto it.
2. Show the reason, not just the verdict: every recommendation sits next to the EVs it was chosen from.
3. Never let a stale number look current.
4. Fast entry beats decoration, especially in manual mode on a phone.
5. Precision over roundness: 0,1 % differences change decisions.

## Accessibility & Inclusion

WCAG AA contrast, aria-labels on all actions, results announced through an aria-live region, full keyboard play on desktop, color never the sole signal.
