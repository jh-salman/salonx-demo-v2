/**
 * Frontend-first booking catalog helpers.
 *
 * Service rows currently carry only { id, name, price, image }. Until the
 * backend adds real category / duration / add-on fields, we derive them from
 * the service name. If the backend later provides `category`, `durationMinutes`,
 * or `isAddOn`, those explicit values win.
 */

export const DEFAULT_SERVICE_MIN = 45
export const DEFAULT_ADDON_MIN = 15

/** Minutes for a service; explicit field wins, else a sensible fallback. */
export function serviceDuration(svc, fallback = DEFAULT_SERVICE_MIN) {
  const raw = svc?.durationMinutes ?? svc?.duration ?? svc?.minutes
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** "45 min" / "1h 15m" */
export function durationLabel(min) {
  if (!Number.isFinite(min) || min <= 0) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** "$120" (no cents) */
export function priceLabel(price) {
  return typeof price === 'number' ? `$${price.toFixed(0)}` : ''
}

const ADDON_TEST =
  /(bang trim|beard trim|deep conditioning|bond repair|olaplex|k18|scalp treatment|gray camouflage)/i

/** Split catalog into main services and add-on extras. */
export function splitCatalog(services) {
  const list = Array.isArray(services) ? services : []
  const main = []
  const addOns = []
  for (const s of list) {
    const isAddOn =
      s?.isAddOn === true ||
      (s?.isAddOn === undefined &&
        ADDON_TEST.test(String(s?.name || '')) &&
        (typeof s?.price !== 'number' || s.price <= 45))
    if (isAddOn) addOns.push(s)
    else main.push(s)
  }
  return { main, addOns }
}

const CATEGORY_RULES = [
  ['Haircuts', /(haircut|buzz cut|\bcut\b|trim)/i],
  ['Color', /(color|highlight|balayage|toner|gloss|camouflage|root|correction)/i],
  ['Styling', /(blowout|updo|iron|style|bridal|special event)/i],
  ['Treatments', /(treatment|conditioning|bond repair|olaplex|k18|scalp|keratin|brazilian|perm)/i],
  ['Extensions', /(extension|tape-in|weft)/i],
]

const CATEGORY_ORDER = [
  'Haircuts',
  'Color',
  'Styling',
  'Treatments',
  'Extensions',
  'Other',
]

/** Category for a service; explicit field wins, else keyword match. */
export function categorize(svc) {
  if (svc?.category) return String(svc.category)
  const name = String(svc?.name || '')
  for (const [key, test] of CATEGORY_RULES) {
    if (test.test(name)) return key
  }
  return 'Other'
}

/** Group main services into ordered category sections. */
export function buildServiceCategories(services) {
  const groups = new Map()
  for (const s of services || []) {
    const key = categorize(s)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return [...groups.entries()]
    .sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) + 1 || 99) -
        (CATEGORY_ORDER.indexOf(b[0]) + 1 || 99),
    )
    .map(([name, items]) => ({ name, items }))
}

/** Totals for the current cart selection. */
export function cartTotals({
  services = [],
  addOns = [],
  selectedServiceIds = [],
  selectedAddOnIds = [],
}) {
  const byId = new Map(
    [...services, ...addOns].map((s) => [String(s.id), s]),
  )
  let price = 0
  let duration = 0
  let count = 0
  for (const id of selectedServiceIds) {
    const s = byId.get(String(id))
    if (!s) continue
    if (typeof s.price === 'number') price += s.price
    duration += serviceDuration(s)
    count += 1
  }
  for (const id of selectedAddOnIds) {
    const s = byId.get(String(id))
    if (!s) continue
    if (typeof s.price === 'number') price += s.price
    duration += serviceDuration(s, DEFAULT_ADDON_MIN)
    count += 1
  }
  return { price, duration, count }
}
