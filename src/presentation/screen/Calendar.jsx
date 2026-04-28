import React, { useMemo, useState } from "react";
import { addDays, format, isSameDay, isToday, startOfWeek, startOfMonth, endOfMonth, endOfWeek } from "date-fns";
import BottomToolbar from "../../component/BottomToolbar";
import "../style/calendar.css";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const SLOT_HEIGHT = 56; // match app
const TIME_AXIS_WIDTH = 40;

function ArrowIcon({ dir = "left" }) {
  return (
    <svg
      className={`cal-arrow ${dir === "right" ? "is-right" : ""}`}
      width="16"
      height="10"
      viewBox="0 0 15.6059 10.1073"
      fill="none"
      aria-hidden="true"
    >
      <g>
        <path
          d="M4.74241 4.97939L8.48012 0.307264L4.11946 0.307263L0.381754 4.97939L4.11946 9.80726L8.48011 9.80726L4.74241 4.97939Z"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <path
          d="M14.8228 0.299999L12.0195 0.299999L8.12607 4.97213L12.0195 9.8L14.9785 9.8L11.0851 4.97213L14.8228 0.299999Z"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}

const mockToolbarEvents = [
  // Parked (orange)
  { id: "pk-1", title: "Candy Smiles", isParked: true, color: "#FF7701" },
  { id: "pk-2", title: "Joe Styles", isParked: true, color: "#FF7701" },
  // Waitlist (green) – show timestamp + optional service
  { id: "wl-1", title: "Nita Haredoo", waitlistAddedAt: new Date(2025, 6, 28, 9, 12), service: "Haircut", color: "#9DE684" },
  { id: "wl-2", title: "Cristi Curls", waitlistAddedAt: new Date(2025, 6, 28, 10, 31), service: "Beard Trim", color: "#9DE684" },
];

const mockAppointments = [
  {
    id: "ev-1",
    clientName: "Cristi Curls",
    service: "Extension Install",
    start: new Date(2025, 6, 28, 10, 0),
    end: new Date(2025, 6, 28, 11, 0),
    color: "pink",
  },
  {
    id: "ev-2",
    clientName: "Jon Klein",
    service: "Full lived-in colour",
    start: new Date(2025, 6, 28, 10, 30),
    end: new Date(2025, 6, 28, 11, 15),
    color: "blue",
  },
  {
    id: "ev-3",
    clientName: "Joe Styles",
    service: "Men's haircut & color",
    start: new Date(2025, 6, 28, 12, 45),
    end: new Date(2025, 6, 28, 13, 45),
    color: "gray",
  },
  {
    id: "ev-4",
    clientName: "Nita Haredoo",
    service: "Extensions and colour",
    start: new Date(2025, 6, 28, 15, 30),
    end: new Date(2025, 6, 28, 16, 0),
    color: "green",
  },
];

function minutesSinceStart(d) {
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function overlaps(a, b) {
  return a.start < b.end && a.end > b.start;
}

function layoutDayAppointments(apts) {
  const sorted = [...apts].sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups = [];
  for (const apt of sorted) {
    let placed = false;
    for (const g of groups) {
      if (g.some((x) => overlaps(x, apt))) continue;
      g.push(apt);
      placed = true;
      break;
    }
    if (!placed) groups.push([apt]);
  }
  const totalCols = groups.length;
  const positioned = [];
  groups.forEach((col, colIndex) => {
    col.forEach((apt) => positioned.push({ apt, colIndex, totalCols }));
  });
  return positioned;
}

function colorToClass(c) {
  if (c === "pink") return "is-pink";
  if (c === "blue") return "is-blue";
  if (c === "green") return "is-green";
  return "is-gray";
}

export default function CalendarScreenWeb() {
  const [viewMode, setViewMode] = useState("day"); // day | week | month
  const [currentDate, setCurrentDate] = useState(() => new Date(2025, 6, 28));
  const [selectedApt, setSelectedApt] = useState(null);

  const parked = useMemo(
    () => mockToolbarEvents.filter((e) => e.isParked === true),
    []
  );
  const waitlist = useMemo(
    () =>
      mockToolbarEvents
        .filter((e) => !e.isParked && e.waitlistAddedAt)
        .sort((a, b) => new Date(a.waitlistAddedAt).getTime() - new Date(b.waitlistAddedAt).getTime()),
    []
  );

  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const fiveDayDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(currentDate, i)),
    [currentDate]
  );

  const dayAppointments = useMemo(
    () => mockAppointments.filter((a) => isSameDay(a.start, currentDate)),
    [currentDate]
  );

  const positioned = useMemo(() => layoutDayAppointments(dayAppointments), [dayAppointments]);

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const monthWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [currentDate]);

  return (
    <div className="cal-root">
      <div className="cal-header">
        <button
          className="cal-nav"
          onClick={() => setCurrentDate((d) => addDays(d, viewMode === "month" ? -30 : -1))}
          aria-label="Previous"
        >
          <ArrowIcon dir="left" />
        </button>

        <div className="cal-tabs" role="tablist" aria-label="Calendar view">
          <button className={`cal-tab ${viewMode === "day" ? "is-active" : ""}`} onClick={() => setViewMode("day")}>
            Day
          </button>
          <button className={`cal-tab ${viewMode === "week" ? "is-active" : ""}`} onClick={() => setViewMode("week")}>
            5 Day
          </button>
          <button className={`cal-tab ${viewMode === "month" ? "is-active" : ""}`} onClick={() => setViewMode("month")}>
            Month
          </button>
          <span className="cal-tabDivider is-1" aria-hidden="true" />
          <span className="cal-tabDivider is-2" aria-hidden="true" />
          <span className="cal-tabIndicator" data-mode={viewMode} />
        </div>

        <button
          className="cal-nav"
          onClick={() => setCurrentDate((d) => addDays(d, viewMode === "month" ? 30 : 1))}
          aria-label="Next"
        >
          <ArrowIcon dir="right" />
        </button>
      </div>

      <div className="cal-weekrow">
        {(viewMode === "week" ? fiveDayDates : weekDates).map((d) => {
          const selected = isSameDay(d, currentDate);
          const today = isToday(d);
          return (
            <button
              key={d.toISOString()}
              className={`cal-daychip ${selected ? "is-selected" : ""} ${today ? "is-today" : ""}`}
              onClick={() => {
                setCurrentDate(d);
                if (viewMode === "month") setViewMode("week");
              }}
            >
              <div className="cal-daychip__dow">{format(d, "EEEEE")}</div>
              <div className="cal-daychip__num">{format(d, "d")}</div>
            </button>
          );
        })}
      </div>

      {/* Parked / waitlist bar placeholder (same spot as app AllDaySection) */}
      {viewMode !== "month" ? (
        <div className="cal-toolbar">
          {parked.map((p) => (
            <div key={p.id} className="cal-pill is-parked">
              <span className="cal-pill__stripe" aria-hidden="true" />
              <span className="cal-pill__text">{p.title}</span>
            </div>
          ))}
          {waitlist.length === 1 ? (
            <div className="cal-pill is-waitlist">
              <span className="cal-pill__dot" aria-hidden="true" />
              <span className="cal-pill__text">{waitlist[0].title}</span>
              <span className="cal-pill__meta">{format(new Date(waitlist[0].waitlistAddedAt), "M/d  HH:mm")}</span>
              {waitlist[0].service ? <span className="cal-pill__svc">{waitlist[0].service}</span> : null}
            </div>
          ) : waitlist.length > 1 ? (
            <div className="cal-pill is-waitlist">
              <span className="cal-pill__dot" aria-hidden="true" />
              <span className="cal-pill__text">Waiting ({waitlist.length})</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {viewMode === "month" ? (
        <div className="cal-month">
          <div className="cal-month__head">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((l) => (
              <div key={l} className="cal-month__hcell">
                {l}
              </div>
            ))}
          </div>
          {monthWeeks.map((week, i) => (
            <div key={i} className="cal-month__week">
              {week.map((d) => (
                <button
                  key={d.toISOString()}
                  className={`cal-month__cell ${isSameDay(d, currentDate) ? "is-selected" : ""}`}
                  onClick={() => {
                    setCurrentDate(d);
                    setViewMode("week");
                  }}
                >
                  <div className="cal-month__num">{format(d, "d")}</div>
                  <div className="cal-month__dots">
                    <span className="dot is-blue" />
                    <span className="dot is-pink" />
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="cal-day">
          <div className="cal-day__axis" style={{ width: TIME_AXIS_WIDTH }}>
            {hours.map((h) => (
              <div key={h} className="cal-axis__row" style={{ height: SLOT_HEIGHT }}>
                <span className="cal-axis__label">{format(new Date(0, 0, 0, h), "h a")}</span>
              </div>
            ))}
          </div>

          <div className="cal-day__grid">
            {hours.map((h) => (
              <div key={h} className="cal-grid__row" style={{ height: SLOT_HEIGHT }} />
            ))}

            {positioned.map(({ apt, colIndex, totalCols }) => {
              const topMin = clamp(minutesSinceStart(apt.start), 0, (DAY_END_HOUR - DAY_START_HOUR + 1) * 60);
              const endMin = clamp(minutesSinceStart(apt.end), 0, (DAY_END_HOUR - DAY_START_HOUR + 1) * 60);
              const top = (topMin / 60) * SLOT_HEIGHT;
              const height = Math.max(28, ((endMin - topMin) / 60) * SLOT_HEIGHT);
              const colW = (1 / totalCols) * 100;
              const left = colIndex * colW;
              return (
                <button
                  key={apt.id}
                  className={`cal-apt ${colorToClass(apt.color)}`}
                  style={{ top, height, left: `${left}%`, width: `${colW}%` }}
                  onClick={() => setSelectedApt(apt)}
                >
                  <div className="cal-apt__client">{apt.clientName}</div>
                  <div className="cal-apt__service">{apt.service}</div>
                  <div className="cal-apt__time">
                    {format(apt.start, "h:mm a")} – {format(apt.end, "h:mm a")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedApt ? (
        <div className="cal-modal" role="dialog" aria-modal="true">
          <button className="cal-modal__backdrop" onClick={() => setSelectedApt(null)} aria-label="Close" />
          <div className="cal-modal__card">
            <div className="cal-modal__title">Appointment Options</div>
            <div className="cal-modal__subtitle">
              {selectedApt.clientName} • {format(selectedApt.start, "h:mm a")} – {format(selectedApt.end, "h:mm a")}
            </div>
            {["Modify appointment", "Reschedule appointment", "Cancel appointment"].map((t) => (
              <button key={t} className="cal-modal__btn" onClick={() => setSelectedApt(null)}>
                {t}
              </button>
            ))}
            <button className="cal-modal__close" onClick={() => setSelectedApt(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      <BottomToolbar activeIndex={3} />
    </div>
  );
}

