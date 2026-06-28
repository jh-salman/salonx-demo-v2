import { DEFAULT_CAPTION, POST_TYPES } from "./rampData";
import { getRampBrandPresets } from "../../data/rampBrandPresets.js";

export function buildTitle(name) {
  const trimmed = (name || "Salon X").trim();
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

let postSeq = 0;

export function createRampPostId() {
  postSeq += 1;
  return `ramp-post-${postSeq}`;
}

export function createRampPost({
  id = createRampPostId(),
  target = { name: "Maria Delgado", sub: "Balayage · Gloss" },
  type = "Curiosity",
  caption = null,
  tags = null,
  links = null,
  heroImage = null,
  heroEmoji = "🧑‍🦰",
  thumbClass = "t1",
  armed = false,
  filmstrip = [
    { id: "fs1", emoji: "🧑‍🦰" },
    { id: "fs2", emoji: "📷" },
    { id: "fs3", emoji: "🎬" },
  ],
  activeFilmId = "fs1",
  capturedImages = [],
  generatedImages = [],
  generatedImage = null,
  genState = "idle",
  status = "queued",
  buildPhase = "compose",
  backgroundId = "bg1",
  clientId = null,
  source = "capture",
  editSteps = {
    caption: false,
    hero: false,
    type: false,
    bg: false,
    tags: false,
    link: false,
  },
} = {}) {
  const presets = getRampBrandPresets();
  return {
    id,
    clientId,
    target,
    type: POST_TYPES.includes(type) ? type : "Curiosity",
    caption: caption ?? presets.caption ?? DEFAULT_CAPTION,
    tags: tags ?? presets.tags.map((tag) => ({ ...tag })),
    links: links ?? presets.links.map((link) => ({ ...link })),
    heroImage,
    heroEmoji,
    thumbClass,
    armed,
    filmstrip,
    activeFilmId,
    capturedImages: [...capturedImages],
    generatedImages: [...generatedImages],
    generatedImage,
    genState,
    status,
    buildPhase,
    backgroundId,
    source,
    editSteps: { ...editSteps },
  };
}

/** Map a server RampPost record → the UI post model. */
export function postFromApi(dto) {
  if (!dto) return createRampPost();
  const captured = Array.isArray(dto.capturedImages) ? dto.capturedImages : [];
  const generated = Array.isArray(dto.generatedImages) ? dto.generatedImages : [];
  const heroUrl = dto.heroImage || captured[0] || null;
  const generatedImage = generated.length > 0 ? generated[generated.length - 1] : null;
  const isGenerating = dto.genState === "generating" && !generatedImage;
  const buildPhase = generatedImage ? (dto.shipMode ? "shipped" : "ship") : "compose";

  return createRampPost({
    id: dto.id,
    clientId: dto.clientId || null,
    target: { name: dto.clientName || "Salon X", sub: dto.clientSub || "" },
    type: dto.type,
    caption: dto.caption,
    tags: Array.isArray(dto.tags) ? dto.tags.map((tag) => ({ ...tag })) : undefined,
    links: Array.isArray(dto.links) ? dto.links.map((link) => ({ ...link })) : undefined,
    heroImage: heroUrl,
    heroEmoji: dto.clientEmoji || "🧑",
    capturedImages: captured,
    generatedImages: generated,
    generatedImage,
    genState: isGenerating ? "generating" : dto.genState || "idle",
    status: dto.status || "queued",
    buildPhase,
    backgroundId: dto.backgroundId || "bg1",
    source: dto.source || "capture",
    filmstrip: heroUrl
      ? [
          { id: "fs1", emoji: dto.clientEmoji || "🧑", image: heroUrl },
          { id: "fs2", emoji: "📷" },
          { id: "fs3", emoji: "🎬" },
        ]
      : undefined,
  });
}

/** Map the UI post model → a content patch for the server (no status/ship fields). */
export function postToApiPatch(post) {
  if (!post) return {};
  return {
    clientName: post.target?.name,
    clientSub: post.target?.sub,
    clientEmoji: post.heroEmoji,
    type: post.type,
    caption: post.caption,
    tags: post.tags,
    links: post.links,
    backgroundId: post.backgroundId,
    heroImage: post.heroImage,
    capturedImages: post.capturedImages,
  };
}

export function postFromQueueCard(card) {
  if (!card) return createRampPost();
  const heroImage = card.heroImage || null;
  return createRampPost({
    id: card.postId || card.id,
    clientId: card.clientId || null,
    target: { name: card.name, sub: card.sub || card.meta },
    heroEmoji: card.emoji || "🧑",
    thumbClass: card.thumb || "t1",
    armed: Boolean(card.armed),
    heroImage,
    filmstrip: heroImage
      ? [
          { id: "fs1", emoji: card.emoji || "🧑", image: heroImage },
          { id: "fs2", emoji: "📷" },
          { id: "fs3", emoji: "🎬" },
        ]
      : undefined,
    activeFilmId: "fs1",
    status: card.status || "queued",
    genState: card.genState || "idle",
    generatedImages: card.generatedImages || [],
    type:
      card.pills?.find((pill) => pill.dot)?.label?.includes("Before")
        ? "Before / After"
        : card.pills?.find((pill) => pill.dot)?.label || "Curiosity",
  });
}

export function markEditStep(post, step, changed = true) {
  if (!post?.editSteps) return post;
  return {
    ...post,
    editSteps: { ...post.editSteps, [step]: changed },
  };
}

export function resolveHeroDisplay(post) {
  if (post?.generatedImage) return { kind: "image", src: post.generatedImage };
  if (post?.heroImage) return { kind: "image", src: post.heroImage };
  return { kind: "emoji", src: post?.heroEmoji || "🧑" };
}
