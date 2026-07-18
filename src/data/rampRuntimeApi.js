import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isRampApiAvailable } from './rampApi.js'

function rampBase() {
  const base = getV2AdminBase()
  if (!base) throw new Error('API is not configured')
  return base
}

async function rampFetch(path, options = {}) {
  const base = rampBase()
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : null
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

export function isRampRuntimeApiAvailable() {
  return isRampApiAvailable()
}

/** List queue/build items. status: 'active' | 'all' | queued | building | generated | shipped */
export async function fetchRampPosts(status = 'active') {
  const data = await rampFetch(`/api/ramp/posts?status=${encodeURIComponent(status)}`)
  return Array.isArray(data?.posts) ? data.posts : []
}

export async function getRampPost(id) {
  const data = await rampFetch(`/api/ramp/posts/${encodeURIComponent(id)}`)
  return data?.post ?? null
}

function mapRampPublicPost(post) {
  if (!post) return null
  const generated = Array.isArray(post.generatedImages) ? post.generatedImages : []
  const generatedImage = generated.length > 0 ? generated[generated.length - 1] : null
  if (!generatedImage) return null
  return {
    id: post.id,
    clientName: post.clientName,
    clientSub: post.clientSub,
    generatedImage,
    status: post.status,
  }
}

/** Public share — generated image metadata only. Falls back to post GET when /public is unavailable. */
export async function getRampPublicPost(id) {
  const key = encodeURIComponent(id)
  try {
    const data = await rampFetch(`/api/ramp/public/${key}`)
    if (data?.post?.generatedImage) return data.post
  } catch (err) {
    const msg = String(err?.message || '')
    if (!/not found/i.test(msg)) throw err
  }

  const post = await getRampPost(id)
  return mapRampPublicPost(post)
}

export async function createRampPost(payload) {
  const data = await rampFetch('/api/ramp/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data?.post ?? null
}

export async function patchRampPost(id, patch) {
  const data = await rampFetch(`/api/ramp/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data?.post ?? null
}

export async function deleteRampPost(id) {
  await rampFetch(`/api/ramp/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Kick off async server-side generation (202 — Render-safe). */
export async function startRampPostGeneration(id, { caption } = {}) {
  const body = {}
  if (caption) body.caption = caption
  const data = await rampFetch(`/api/ramp/posts/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data?.post ?? null
}
