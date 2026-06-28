/** Local mock data — mirrors `ramp_prototype.html`. No RAMP API calls. */

export const MOCK_QUEUE = [
  {
    id: "q-maria",
    name: "Maria Delgado",
    meta: "Balayage · Gloss · 8:04a",
    thumb: "t1",
    emoji: "🧑‍🦰",
    sub: "Balayage · Gloss · Care",
    stylist: "Joe",
    armed: false,
    pills: [
      { label: "Curiosity", dot: true },
      { label: "3 assets" },
    ],
  },
  {
    id: "q-tariq",
    name: "Tariq Bell",
    meta: "Cut · Style · 7:46a",
    thumb: "t2",
    emoji: "🧑",
    sub: "Cut · Style",
    stylist: "Joe",
    armed: true,
    armedLabel: "⚡ Before/After armed",
    pills: [
      { label: "Before/After", dot: true },
      { label: "2 assets" },
    ],
  },
  {
    id: "q-priya",
    name: "Priya N.",
    meta: "Color Correction · 9:12a",
    thumb: "t4",
    emoji: "👩",
    sub: "Color Correction",
    stylist: "Dana",
    armed: false,
    pills: [
      { label: "Professional", dot: true },
      { label: "1 asset" },
    ],
  },
];

export const MOCK_S5_RETURN = {
  id: "q-s5",
  name: "Joe Stylzzz",
  meta: "S5 selfie · just now",
  thumb: "t2",
  emoji: "🤳",
  sub: "S5 selfie · Curiosity",
  pills: [
    { label: "✓ Pre-attributed", src: true },
    { label: "Ready" },
  ],
};

export const DEFAULT_CAPTION =
  "This changes everything… ✨ Tap to see what Joe did →";

export const POST_TYPES = [
  "Curiosity",
  "Professional",
  "Hype / Event",
  "Before / After",
];

export const DEFAULT_TAGS = [
  { id: "t1", label: "#DangerJones", on: true },
  { id: "t2", label: "#PremiereOrlando", on: true },
  { id: "t3", label: "#PremierHairShow", on: true },
  { id: "t4", label: "@JOE_STYLZ", on: true, inherited: true },
];

export const DEFAULT_CHIPS = [
  { label: "#DangerJones", dot: true },
  { label: "#PremiereOrlando", dot: true },
  { label: "@JOE_STYLZ", inherited: true },
  { label: "Referral", inherited: true },
];

export const RAMP_ASSUMES = [
  { k: "Salon", v: "Salon X · Orlando" },
  { k: "Brand partners", v: "Danger Jones · R+Co" },
  { k: "Stylist", v: "Joe" },
];

export const HERO_RAMP_PHOTOS = [
  { id: "h1", emoji: "🧑‍🦰", badge: "8:04a", tone: "p1" },
  { id: "h2", emoji: "📷", badge: "8:05a", tone: "p2" },
  { id: "h3", emoji: "🎬", badge: "reel", tone: "p3" },
];

export const HERO_CLIENT_PHOTOS = [
  { id: "hc1", emoji: "👤", badge: "May 2", tone: "p4" },
  { id: "hc2", emoji: "👤", badge: "Apr 9", tone: "p5" },
  { id: "hc3", emoji: "👤", badge: "Mar 1", tone: "p6" },
];

export const BG_PRESETS = [
  { id: "bg1", emoji: "🏞️", tone: "p2" },
  { id: "bg2", emoji: "🌆", tone: "p1" },
  { id: "bg3", emoji: "⛰️", tone: "p3" },
];

export const S5_STEPS = [
  {
    done: true,
    title: "Pre-attributed via magic link",
    desc: "Client, service, tags, salon, stylist — all known from the token.",
  },
  {
    done: true,
    title: "Composed in the cloud",
    desc: "Subject cut out, placed on the attributed background, undistorted.",
  },
  {
    done: false,
    title: "Delivered back via RCS → MMS",
    desc: "Client receives a finished, shippable post in their texts.",
  },
  {
    done: false,
    title: "Lands in the cloud library",
    desc: "Persists for the stylist on any device.",
  },
];

export const IMPORT_ATTRIBUTION = [
  { k: "Client", v: "Maria Delgado" },
  { k: "Service", v: "Balayage · Gloss" },
  { k: "Stylist", v: "Joe" },
  { k: "Date", v: "Today · 8:24a" },
];
