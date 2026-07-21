import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export const DAY_VIEW_BUFFER_DAYS = 2
export const MONTH_VIEW_BUFFER_DAYS = 7

/**
 * API fetch window for the active calendar view (UI unchanged — smaller payloads).
 * @param {'day' | 'week' | 'month' | string} viewMode
 * @param {Date} anchorDate
 */
export function rangeForView(viewMode, anchorDate) {
  const d = startOfDay(anchorDate instanceof Date ? anchorDate : new Date(anchorDate))

  if (viewMode === 'week') {
    return {
      from: startOfWeek(d, { weekStartsOn: 0 }),
      to: endOfWeek(d, { weekStartsOn: 0 }),
    }
  }

  if (viewMode === 'month') {
    return {
      from: startOfDay(addDays(startOfMonth(d), -MONTH_VIEW_BUFFER_DAYS)),
      to: endOfDay(addDays(endOfMonth(d), MONTH_VIEW_BUFFER_DAYS)),
    }
  }

  return {
    from: startOfDay(addDays(d, -DAY_VIEW_BUFFER_DAYS)),
    to: endOfDay(addDays(d, DAY_VIEW_BUFFER_DAYS)),
  }
}

/** @param {{ fromMs: number, toMs: number }[]} fetchedRanges */
export function isRangeFetched(fetchedRanges, from, to) {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  return fetchedRanges.some((r) => r.fromMs <= fromMs && r.toMs >= toMs)
}

/** @param {{ fromMs: number, toMs: number }[]} fetchedRanges */
export function recordFetchedRange(fetchedRanges, from, to) {
  return [
    ...fetchedRanges,
    { fromMs: from.getTime(), toMs: to.getTime() },
  ]
}
