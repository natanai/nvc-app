# Magnet directory search

The magnet directory pages (Feelings, Needs, and Situations) share a common
search workflow that is orchestrated by `scripts/magnets.js`.

## UI elements

Each page renders a `.magnet-search` container above the magnet board. The
container includes:

- A search `<input>` wired with `data-magnet-search-input`.
- A results wrapper (`data-magnet-search-results`) that holds the live match
  count (`data-magnet-search-count`) and a list for result pills
  (`data-magnet-search-list`).

See the Feelings page for an example structure.【F:feelings/index.html†L234-L249】

## Initialisation

When a board is initialised the script collects references to the search
container and its children alongside the magnet metadata it already maintains.
Every magnet stores a normalised `searchValue` and a display `searchLabel` so
matches can be rendered as human-friendly links.【F:scripts/magnets.js†L1030-L1091】

## Searching

Typing in the search box triggers `applySearchQuery`. The query is trimmed and
normalised to lowercase before filtering the cached magnet metadata. Search
mode is enabled when a non-empty query is present, which pauses physics,
hides the board, and disables the shuffle button so focus stays on the
results list.【F:scripts/magnets.js†L843-L905】【F:scripts/magnets.js†L1000-L1014】

`renderSearchResults` rebuilds the pill list for each change, preserving link
attributes when magnets point to other pages. The live result count announces
matches (or lack thereof) via `aria-live` for screen readers.【F:scripts/magnets.js†L906-L999】

## Clearing

Clearing the input exits search mode. The board is shown again, the shuffle
button returns to its previous state, any prior physics play state is restored,
and the result panel is emptied.【F:scripts/magnets.js†L868-L905】
