import { dataUrlToBlob } from './rampUpload.js'

/** Build OpenAI prompt from local post draft (image generation API only). */
export function buildRampImagePrompt(postOrFields) {
  if (postOrFields && typeof postOrFields === "object" && "target" in postOrFields) {
    const post = postOrFields;
    const name = post?.target?.name?.trim() || "the client";
    const type = post?.type || "Curiosity";
    const caption = post?.caption?.trim() || "";
    const tags = (post?.tags ?? [])
      .filter((tag) => tag.on)
      .map((tag) => tag.label)
      .join(", ");

    return [
      `Transform this photo into a premium salon social media post for ${name}.`,
      `Post type: ${type}.`,
      caption ? `Caption direction: ${caption}` : "",
      tags ? `Brand tags: ${tags}` : "",
      "Keep the subject recognizable. Elegant branded layout, high-end salon aesthetic.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const { clientName, direction } = postOrFields || {};
  const name = String(clientName || "").trim() || "the client";
  const extra = String(direction || "").trim();

  return [
    `Transform this photo into a premium salon social media post for ${name}.`,
    extra ? `Caption direction: ${extra}` : "",
    "Keep the subject recognizable. Elegant branded layout, high-end salon aesthetic.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function revokeRampObjectUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }
}

/** data URL / blob URL / remote URL → File for multipart upload. */
export async function imageRefToFile(imageRef, filename = 'ramp-capture.png') {
  const ref = String(imageRef || '').trim()
  if (!ref) return null

  if (ref.startsWith('data:')) {
    const blob = dataUrlToBlob(ref)
    const type = blob.type || 'image/png'
    const ext = type.includes('png') ? 'png' : 'jpg'
    return new File([blob], filename.replace(/\.\w+$/, `.${ext}`), { type })
  }

  try {
    const { http } = await import('../lib/http.js')
    const res = await http.get(ref, { responseType: 'blob' })
    const blob = res.data
    const type = blob.type || 'image/png'
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    return new File([blob], filename.replace(/\.\w+$/, `.${ext}`), { type })
  } catch {
    return null
  }
}
