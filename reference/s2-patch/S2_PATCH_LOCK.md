# S2 PATCH LOCK — Execution Law

**Mode:** surgical delta · visual overlay reference · zero drift  
**Scope:** Screen2 main client stage only (`Screen2.jsx` + `s2.css` + consultation popup header chrome that mirrors S2)

> **Treat `S2_PATCH_APPROVED.png` as a visual overlay reference — NOT a redesign reference.**

Do not “clean up”, “modernize”, “improve consistency”, or reinterpret unrelated geometry.

---

## Handoff files (read in this order)

| File | Role |
|------|------|
| `ORIGINAL_S2_BASE.png` | **Constitutional authority** — untouched layout, spacing logic, protected systems |
| `S2_PATCH_APPROVED.png` | **Approved delta only** — what may change |
| `S2_PATCH_LOCK.md` | **This file** — what may / may not be edited |

Path: `salonx-web-v2/reference/s2-patch/`

Visual law also applies: `.cursor/rules/salonx-ui-governance.mdc` (4px grid, patch-only).

---

## Allowed modifications (ONLY these six deltas)

Implement **only** the differences visible between FILE 01 and FILE 02.

### 1. Enlarged client image
- Increase `.s2-avatar` footprint (width/height) per approved patch.
- Preserve square crop, orange border weight **feel**, and rounded-corner language from base.
- Do **not** change avatar tap behavior (camera / gallery / double-tap preview).

### 2. Upward image shift
- Move avatar block upward within the header identity row.
- Goal: stronger vertical presence without breaking the top-right curve/date stamp geometry.

### 3. Header rebalance
- Re-center / re-stack client name, phone, visit line relative to the larger avatar.
- Preserve: name → phone → visit hierarchy and centered identity column logic.
- Do **not** reintroduce removed message badge on main header or consultation popup header.

### 4. Timer rebalance
- Adjust `.s2-headerTimer` position so timer bottom aligns with avatar bottom (approved patch).
- Keep timer as interactive control (opens timer modal).
- Do **not** resize timer typography beyond what the patch requires for alignment.

### 5. Reduced CTA containers
- Reduce **REBOOK** / **CLIMAX** button container height/padding only (`.s2-actionCard .s2-cta` family).
- Keep 2-column grid, labels, borders, and dock placement.
- Do **not** shrink label caps size unless required to match approved patch (labels stay ALL CAPS).

### 6. Blue CLIMAX icon
- CLIMAX play/flag icon becomes **blue** in the approved patch (REBOOK icon unchanged).
- Apply via targeted class (e.g. `.s2-cta.is-checkout .s2-flagIcon` or icon color token).
- Do **not** recolor other orange accent systems globally.

---

## Protected systems (DO NOT MODIFY unless listed above)

### Layout & chrome (frozen)
- Top-right curved SVG position (`top: -25px`, `right: -5px` footprint) — **do not move**
- Date stamp position relative to curve (`THU / 21 / MAY` stack)
- Calendar hit zone behavior (curve + date → calendar) on S2 + consultation popup
- Back arrow row (`.s2-topbar`)
- Progress stepper: CHECK → CONSULT → SERVICE → LIFT → REBOOK (dots, lines, labels)
- Section order: CONSULTATION → CREATE → FINISH → action dock → bottom toolbar
- Bottom toolbar icon set and active state logic

### Content panels (frozen geometry)
- Consultation preview card / list row rhythm
- CREATE pills + dashed ADD SERVICE + suggested line
- FINISH product strip + dashed ADD PRODUCT + suggested line
- Section title rules (centered caps between hairlines)
- Consultation popup body structure (when open)

### Dynamic architecture (runtime — do not break)
- API-backed catalog pills / products / suggested lines
- Consultation persistence (local + remote)
- Appointment / timer / workflow state (`S2_WORKFLOW_STEPS`, rebook popup, MOVE TO PARK)
- Realtime sync (appointments, toolbar waitlist/park, catalogs)
- Navigation: back target, calendar, climax, consultation open/close
- Optimistic saves + session caches

### Typography & tokens (no global drift)
- Do not change unrelated font sizes, letter-spacing, or line-heights outside the six deltas
- Do not swap font families
- Do not introduce new shadows, glows, or glass treatments on frozen sections
- Stay on 4px spacing grid (`4 · 8 · 12 · 16 · 20 · 24`)

---

## Forbidden actions

- Rebuild header, sections, or dock from scratch
- Move or rescale top-right curve SVG to “fit” the patch
- Add/remove UI elements not in either reference file (e.g. kebab menu, message badge)
- Cascade restyle into consultation popup body, Climax, Calendar, or Screen1
- Change button **labels** (REBOOK / CLIMAX) or workflow meaning
- “Improve” spacing in CREATE/FINISH/CONSULTATION because the header changed
- Replace dynamic mock data with hardcoded copy
- Touch unrelated files “while you’re here”

---

## Patch workflow (mandatory)

1. Open **ORIGINAL_S2_BASE.png** — note protected geometry.
2. Open **S2_PATCH_APPROVED.png** — list only the six deltas above.
3. Patch **CSS first** (prefer token tweaks on existing selectors).
4. Side-by-side screenshot audit: base areas must match FILE 01; changed areas must match FILE 02.
5. If anything outside the six deltas moved → **revert that hunk** (do not rebuild the screen).

---

## Primary code targets (when implementing)

| Delta | Likely selectors |
|-------|------------------|
| Avatar size + upward shift | `.s2-avatar`, `.s2-identityLeft`, `.s2-identityMain` |
| Header rebalance | `.s2-identityCenter`, `.s2-identityText`, `.s2-clientName`, `.s2-clientPhone`, `.s2-clientVisit` |
| Timer rebalance | `.s2-identityRight`, `.s2-headerTimer`, `--s2-header-timer-curve-inset` |
| Smaller CTAs | `.s2-actionCard .s2-cta`, `.s2-actionRow` |
| Blue CLIMAX icon | `.s2-cta.is-checkout .s2-flagIcon` or `.s2-actionCard .s2-cta.is-checkout .s2-ctaIcon` |

**Files:** `salonx-web-v2/src/presentation/screen/s2.css`, `Screen2.jsx` (icon markup only if required).

---

## Success metric

Side-by-side with **S2_PATCH_APPROVED.png**:

- Six deltas match
- All protected regions match **ORIGINAL_S2_BASE.png** (except where the six deltas intentionally overlap)
- No visible drift in section density, card proportions, or typography hierarchy elsewhere

If unsure → **do not change it**.
