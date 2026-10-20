---
version: 1
slug: 'src-app-app-tsx'
primary_target: 'src/app/App.tsx'
related_targets: []
---

# Surface: Blackjack Guide app shell (src/app/App.tsx)

Mode: Operate. Audience: analytical players, practice (simulation) and live-table analysis (manual), desktop and phone equally. Task: read the engine's EV per action and act; enter cards fast in manual mode.

## Direction contract

THESIS: The table speaks the language of the printed deck: two inks on ivory card stock. The max-EV action is the only card turned face up; it refuses the category default of a slate dashboard with a blue accent on every highlight.

OWN-WORLD: Deep felt green field (#0f3b2a family) for the table only; panels in card-back ink (#14181c family) with hairline rules; ivory card stock (#f2ead9) reserved for real cards and the single recommended row/button; card red (#c8102e) for red suits, the cut card and bust; EV positive mint / negative rose always with sign. Workhorse sans (Geist) with tabular figures for all UI and data; Bodoni Moda only for card corner indices and the action key index (H, S, D, P, R).

STORY: The visitor sees the hand, sees which action is face up and by how much it beats the next one, understands the risk (bust meter, dealer distribution) and acts with a key or a tap.

FIRST VIEWPORT: 56px top bar (brand, Jugador/Dealer, Simulación/Manual, rules summary button, shoe gauge with red cut-card mark, reshuffle). Felt table fills the left; dealer hand top centre, player hand(s) lower centre, action bar at the felt's bottom with key indices; recommended button in ivory. Right 440px panel: action rows (index letter, name, EV large right-aligned, stacked win/push/lose bar on one fixed 0–100 % scale, figures under), bust meter, dealer outcome bars. Mobile: panel stacks under the table.

FORM: Pip & Index, candidate 5 of 7 on my list. seed: none (unavailable). Raises: Saville (only the recommended action decoded to full colour), airport wayfinding (only legal actions, one decisive band), star atlas (one fixed probability scale across panels).

Signature move: the recommendation flips face up (a card-flip of the recommended row to ivory) whenever the engine's best action changes. Motion grammar: deal = card slides from the shoe corner; hole card flips on reveal; stale numbers dim in place.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
