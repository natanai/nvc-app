# Quick reference: Bluesky login, saving, and sharing (allneeds.app)

Use this page as a last‑page handout to clarify what signing in does (and does **not** do), how to save or move your data, and how to share strategies.

## 1) If you never sign in (local‑only mode)

- Everything stays on **this browser/device** until you export it.
- Use **Export localStorage** to download a JSON snapshot of your inventory/journal/customizer data.
- Use **Import localStorage** later to load that snapshot on the same or another device.
- You can still browse the **public** strategy feed while signed out.

**Best for:** keeping everything private/offline; no server storage.

## 2) Optional Bluesky sign‑in (identity only)

- Sign in from the **Inventory** page with your Bluesky handle.
- Sign‑in is handled by Bluesky’s OAuth flow; **the site never sees your Bluesky password**.
- **Signing in alone does not move or sync any data.** It only lets the browser prove who you are to the allneeds backend.

**Best for:** enabling optional sharing and backend save/load, while still controlling exactly what gets sent.

## 3) Choosing visibility for a strategy

When you add or edit a strategy, choose who can see it:

- **Private** – stays local unless you export it yourself.
- **Followers** – shareable to Bluesky followers **only when you are signed in**.
- **Public** – shareable to everyone **only when you are signed in**.

**Important:**
- If you are signed out, Followers/Public options are disabled and revert to Private.
- Even when signed in, Followers/Public strategies can still stay local until you choose to share them.

## 4) Sharing to the feed (optional)

- When you save a Followers/Public strategy, you’ll be asked if you want to **share it to the backend right away**.
- You can also keep it local and share later from the Inventory page.
- The **Shared feed** shows:
  - **Public** strategies for everyone.
  - **Followers** strategies only when signed in (from people you follow).

## 5) Optional backend save/load (cloud snapshot)

If you are signed in, you can send or fetch a **single JSON snapshot** of your inventory (same data as local export), keyed to your Bluesky DID.

- **Save current data to allneeds backend** – uploads the snapshot.
- **Load data from allneeds backend** – downloads it on another device or after a reset.

**Privacy note:** the snapshot is stored on the allneeds backend and could be seen by the server operator or exposed in a breach. If that doesn’t feel right, use local export/import instead.

## 6) Getting your strategies into the main needs library

- Use **“email me your strategies pretty please 🙏 – Nat”** from the Inventory page.
- This exports your personal strategies and prompts you to email the downloaded file to:
  - **ahiccup@gmail.com**
  - Subject line: **“Strategies for allneeds.app!”**

That’s the route for getting strategies considered for the main needs page library.

---

### One‑page summary

- **No login:** everything stays local; use Export/Import to move data.
- **Sign in:** unlocks optional sharing + backend save/load; still nothing auto‑syncs.
- **Share:** choose visibility; Followers/Public only available when signed in.
- **Feed:** public strategies are visible to everyone; follower strategies require sign‑in.
- **Main library:** email exported strategies to **ahiccup@gmail.com**.
