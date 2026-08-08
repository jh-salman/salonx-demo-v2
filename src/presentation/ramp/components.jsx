import { Camera, Copy, Image as ImageIcon } from "phosphor-react";
import { Link } from "react-router-dom";
import { clientInitialLetter } from "../../data/rampClients.js";
import { rampStatusLabel } from "../../data/rampStatus.js";
import { SALON_MODE_SOLO, useSalonMode } from "../../lib/salonMode.js";
import { rampPublicPath, rampPublicUrl } from "./rampPaths";

/** Back button + title used at the top of every detail view. */
export function TopBar({ title, onBack, hint }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button type="button" className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
      ) : null}
      <h3>{title}</h3>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/** Centered RAMP wordmark used on the Master Queue / Station headers. */
export function RampHead({ title = "RAMP", sub, bolt = true }) {
  return (
    <div className="ramp-head">
      {bolt ? <div className="bolt">⚡</div> : null}
      <div className="name">{title}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

/** Section label with a count and an optional right-aligned action link. */
export function Section({ title, count, linkLabel, onLink }) {
  return (
    <div className="sec">
      <span>
        {title}
        {count != null ? <span className="count"> {count}</span> : null}
      </span>
      {onLink ? (
        <button type="button" className="link" onClick={onLink}>
          {linkLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Client photo or first-letter fallback for queue / lookup rows. */
export function ClientThumb({ name, avatar, thumb, className = "qthumb" }) {
  const letter = clientInitialLetter(name);
  const tone = thumb ? ` ${thumb}` : "";
  if (avatar) {
    return (
      <div className={`${className}${tone}`.trim()}>
        <img src={avatar} alt="" className="client-thumb__img" />
      </div>
    );
  }
  return (
    <div className={`${className}${tone} client-thumb--initial`.trim()} aria-hidden>
      {letter}
    </div>
  );
}

/** A single client row in the dashboard / queue lists. */
export function QueueCard({ item, onClick }) {
  const [salonMode] = useSalonMode();
  // Solo build mode: one stylist, so the attribution line is noise.
  const showStylist = salonMode !== SALON_MODE_SOLO;

  return (
    <button type="button" className="qcard" onClick={onClick}>
      {item.armed ? <span className="armed">{item.armed}</span> : null}
      <ClientThumb name={item.name} avatar={item.avatar} thumb={item.thumb} />
      <div className="qbody">
        <div className="qname">{item.name}</div>
        <div className="qmeta">{item.meta}</div>
        {item.pills?.length ? (
          <div className="qstack">
            {item.pills.map((pill) => (
              <span
                key={`${pill.label}-${pill.tone || ""}`}
                className={`pill${pill.dot ? " dot" : ""}${pill.tone ? ` pill--${pill.tone}` : ""}${pill.src ? " src" : ""}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        ) : null}
        {showStylist && item.stylist ? (
          <div className="stylist-tag">— Stylist: {item.stylist}</div>
        ) : null}
      </div>
      <span className="qarrow">›</span>
    </button>
  );
}

/** Bottom sheet overlay. Renders nothing when `open` is false. */
export function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="dim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="grab" onClick={onClose} />
        {children}
      </div>
    </div>
  );
}

/** A tappable choice row inside the bolt sheet. */
export function Choice({ icon, title, desc, primary, onClick }) {
  return (
    <button
      type="button"
      className={`choice${primary ? " primary" : ""}`}
      onClick={onClick}
    >
      <span className="eic">{icon}</span>
      <div>
        <div className="t">{title}</div>
        <div className="d">{desc}</div>
      </div>
    </button>
  );
}

/** Transient confirmation toast. */
export function Toast({ message }) {
  return (
    <div className={`toast${message ? " show" : ""}`} role="status">
      {message}
    </div>
  );
}

/** Compose flow step indicator — Photo → Prompt → Generate. */
export function RampStepPills({ step = 1 }) {
  const items = [
    { n: 1, label: "Photo" },
    { n: 2, label: "Prompt" },
    { n: 3, label: "Generate" },
  ];

  return (
    <div className="ramp-steps" aria-label="Compose steps">
      {items.map(({ n, label }) => {
        const done = step > n;
        const active = step === n;
        return (
          <div
            key={n}
            className={`ramp-steps__item${active ? " is-active" : ""}${done ? " is-done" : ""}`}
          >
            <span className="ramp-steps__num" aria-hidden>
              {done ? "✓" : n}
            </span>
            <span className="ramp-steps__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Photo upload zone — empty drop area or full-bleed preview. */
export function RampUploadZone({
  sourceImage,
  busy = false,
  onPickUpload,
  onPickCapture,
  onRemove,
}) {
  if (sourceImage) {
    return (
      <div className="ramp-upload ramp-upload--filled">
        <img src={sourceImage} alt="Selected client photo" className="ramp-upload__photo" />
        <div className="ramp-upload__bar">
          <button
            type="button"
            className="ramp-upload__action"
            onClick={onPickUpload}
            disabled={busy}
          >
            Change photo
          </button>
          <button
            type="button"
            className="ramp-upload__action ramp-upload__action--ghost"
            onClick={onRemove}
            disabled={busy}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ramp-upload ramp-upload--empty">
      <div className="ramp-upload__empty-icon" aria-hidden>
        <Camera size={28} weight="duotone" />
      </div>
      <p className="ramp-upload__empty-title">Add client photo</p>
      <p className="ramp-upload__empty-sub">Upload or capture for your branded social post</p>
      <div className="ramp-upload__actions">
        <button
          type="button"
          className="build-secondary ramp-upload__pick"
          onClick={onPickUpload}
          disabled={busy}
        >
          <ImageIcon size={16} weight="bold" aria-hidden />
          Upload photo
        </button>
        <button
          type="button"
          className="build-secondary ramp-upload__pick"
          onClick={onPickCapture}
          disabled={busy}
        >
          <Camera size={16} weight="bold" aria-hidden />
          Take photo
        </button>
      </div>
    </div>
  );
}

/** Static queue status key — Pending · Generating · Ready. */
export function RampQueueLegend() {
  const items = [
    { tone: "pending", label: "Pending" },
    { tone: "generating", label: "Generating" },
    { tone: "ready", label: "Ready" },
  ];

  return (
    <div className="qstack ramp-queue-legend" aria-hidden>
      {items.map((item) => (
        <span
          key={item.tone}
          className={`pill pill--${item.tone} dot`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** URL row with copy — page link or direct image asset URL. */
export function RampCopyUrlRow({ url, onCopy, external = false, copyLabel = "Copy" }) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      onCopy?.();
    } catch {
      onCopy?.("Could not copy link");
    }
  };

  return (
    <div className="ramp-public-link">
      {external ? (
        <a
          href={trimmed}
          className="ramp-public-link__url"
          target="_blank"
          rel="noopener noreferrer"
          title={trimmed}
        >
          {trimmed}
        </a>
      ) : (
        <span className="ramp-public-link__url" title={trimmed}>
          {trimmed}
        </span>
      )}
      <button
        type="button"
        className="ramp-public-link__copy"
        onClick={handleCopy}
        aria-label={`Copy ${copyLabel}`}
      >
        <Copy size={12} weight="bold" aria-hidden />
        {copyLabel}
      </button>
    </div>
  );
}

/** Public share URL with copy — shown under generated artifact. */
export function RampPublicLink({ queueId, onCopy }) {
  const url = rampPublicUrl(queueId);

  return (
    <div className="ramp-public-link">
      <Link to={rampPublicPath(queueId)} className="ramp-public-link__url" title={url}>
        {url}
      </Link>
      <button
        type="button"
        className="ramp-public-link__copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            onCopy?.();
          } catch {
            onCopy?.("Could not copy link");
          }
        }}
        aria-label="Copy public link"
      >
        <Copy size={12} weight="bold" aria-hidden />
        Copy
      </button>
    </div>
  );
}

/** Live RAMP status rail — Pending → Ready → Generating. */
export function RampStatusRail({ active = "pending" }) {
  const steps = [
    { id: "pending", label: "Pending" },
    { id: "ready", label: "Ready" },
    { id: "generating", label: "Generating" },
  ];
  const activeIndex = steps.findIndex((step) => step.id === active);

  return (
    <div className="ramp-status-rail" aria-hidden>
      {steps.map((step, index) => {
        const isActive = step.id === active;
        const isDone = activeIndex > index;
        return (
          <div
            key={step.id}
            className={`ramp-status-rail__step ramp-status-rail__step--${step.id}${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
          >
            <span className="ramp-status-rail__dot" />
            <span className="ramp-status-rail__label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Prominent status label for build / generating screens. */
export function RampStatusBadge({ status = "pending", large = false }) {
  return (
    <div className={`ramp-status-badge ramp-status-badge--${status}${large ? " ramp-status-badge--lg" : ""}`}>
      <span className="ramp-status-badge__dot" aria-hidden />
      <span className="ramp-status-badge__label">{rampStatusLabel(status)}</span>
    </div>
  );
}

/** Full-view generating state while AI post renders (ChatGPT-style). */
export function RampGeneratingOverlay({
  show = false,
  rampStatus = "generating",
  previewUrl = null,
  title = "",
  hint = "",
  onBack = null,
}) {
  if (!show) return null;

  return (
    <div
      className="ramp-generating-overlay ramp-generating-overlay--compose"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <TopBar title={title} hint={hint} onBack={onBack} />
      <div className="ramp-generating-overlay__body">
        <div className="ramp-gen-stage">
          {previewUrl ? (
            <div className="ramp-gen-stage__preview">
              <img src={previewUrl} alt="" className="ramp-gen-stage__img" />
              <div className="ramp-gen-stage__shimmer" aria-hidden />
              <div className="ramp-gen-stage__pulse" aria-hidden />
            </div>
          ) : (
            <div className="ramp-gen-stage__orb" aria-hidden>
              <span className="ramp-gen-stage__ring ramp-gen-stage__ring--a" />
              <span className="ramp-gen-stage__ring ramp-gen-stage__ring--b" />
              <span className="ramp-gen-stage__core" />
            </div>
          )}
        </div>
        <RampStatusBadge status={rampStatus} large />
        <RampStatusRail active={rampStatus} />
        <div className="ramp-gen-progress" aria-hidden>
          <span className="ramp-gen-progress__bar" />
        </div>
        <p className="ramp-compose-hint">You can leave this screen — generation continues in the background.</p>
      </div>
    </div>
  );
}
