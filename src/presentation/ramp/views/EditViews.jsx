import { useState } from "react";
import { TopBar } from "../components";
import {
  BG_PRESETS,
  DEFAULT_CAPTION,
  HERO_CLIENT_PHOTOS,
  HERO_RAMP_PHOTOS,
  POST_TYPES,
} from "../rampData";
import { useRamp } from "../rampContext";
import { markEditStep } from "../rampPostModel";

function EditState({ step, post }) {
  const changed = post?.editSteps?.[step];
  return (
    <span className={`state ${changed ? "changed" : "untouched"}`}>
      {changed ? "Changed" : "Untouched"}
    </span>
  );
}

export function EditView() {
  const { post, setView, showToast } = useRamp();
  if (!post) return null;

  const rows = [
    { view: "caption", rank: 1, icon: "✍️", title: "Caption", desc: "The hook. Edited most.", step: "caption" },
    { view: "hero", rank: 2, icon: "🖼️", title: "Hero photo", desc: "RAMP photos + camera roll", step: "hero" },
    { view: "type", rank: 3, icon: "🎭", title: "Post type", desc: "Curiosity · Pro · Hype · B/A", step: "type" },
    { view: "bg", rank: 4, icon: "🌄", title: "Background / reference", desc: "Saved default + swap", step: "bg" },
    { view: "tags", rank: 5, icon: "#️⃣", title: "Tags & attribution", desc: "Usually right from presets", step: "tags" },
    { view: "link", rank: 6, icon: "🔗", title: "Referral link", desc: "Inherited — rarely changed", step: "link" },
  ];

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Edit Post" onBack={() => setView("build")} hint="Untouched = unchanged" />
        {rows.map((row) => (
          <button
            key={row.view}
            type="button"
            className="ebtn"
            onClick={() => setView(row.view)}
          >
            <span className="rank">{row.rank}</span>
            <span className="eic">{row.icon}</span>
            <span className="lab">
              <div className="t">{row.title}</div>
              <div className="d">{row.desc}</div>
            </span>
            <EditState step={row.step} post={post} />
            <span className="car">›</span>
          </button>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            showToast("Changes saved ⚡");
            window.setTimeout(() => setView("build"), 400);
          }}
        >
          Done editing
        </button>
      </div>
    </div>
  );
}

export function CaptionView() {
  const { post, updatePost, setView } = useRamp();
  const [text, setText] = useState(post?.caption || DEFAULT_CAPTION);
  if (!post) return null;

  const count = text.length;
  const apply = () => {
    updatePost(markEditStep({ ...post, caption: text }, "caption", text !== DEFAULT_CAPTION));
    setView("edit");
  };

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Caption" onBack={() => setView("edit")} />
        <textarea
          className="panel-cap"
          value={text}
          maxLength={2200}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="caprow">
          <span className={`capcount${count > 2000 ? " warn" : ""}`}>{count} / 2200</span>
          <button type="button" className="resetbtn" onClick={() => setText(DEFAULT_CAPTION)}>
            ↺ Reset to AI draft
          </button>
        </div>
        <p className="helptxt">
          Curiosity voice locked as default. Edit freely — links and hashtags stay attached.
        </p>
        <button type="button" className="btn btn-green" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function HeroView() {
  const { post, updatePost, setView, openImportSheet } = useRamp();
  const [tab, setTab] = useState(1);
  if (!post) return null;

  const pick = (emoji) => {
    updatePost(
      markEditStep(
        { ...post, heroEmoji: emoji, heroImage: null, buildPhase: "compose", generatedImage: null },
        "hero",
        true,
      ),
    );
  };

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Hero photo" onBack={() => setView("edit")} />
        <div className="tabs">
          <button type="button" className={tab === 1 ? "on" : ""} onClick={() => setTab(1)}>
            ⚡ RAMP photos
          </button>
          <button type="button" className={tab === 2 ? "on" : ""} onClick={() => setTab(2)}>
            📱 Camera roll
          </button>
        </div>
        {tab === 1 ? (
          <div className="pane on">
            <p className="helptxt">Captured through RAMP — attribution attached.</p>
            <div className="grp-h">This session · {post.target?.name}</div>
            <div className="grid">
              {HERO_RAMP_PHOTOS.map((pic) => (
                <button
                  key={pic.id}
                  type="button"
                  className={`pic ${pic.tone}${post.heroEmoji === pic.emoji ? " sel" : ""}`}
                  onClick={() => pick(pic.emoji)}
                >
                  {pic.emoji}
                  <span className="bdg">{pic.badge}</span>
                </button>
              ))}
            </div>
            <div className="grp-h">Other RAMP photos · this client</div>
            <div className="grid">
              {HERO_CLIENT_PHOTOS.map((pic) => (
                <button
                  key={pic.id}
                  type="button"
                  className={`pic ${pic.tone}`}
                  onClick={() => pick(pic.emoji)}
                >
                  {pic.emoji}
                  <span className="bdg">{pic.badge}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pane on">
            <p className="helptxt">Your phone&apos;s photos — no RAMP attribution yet.</p>
            <div className="grid">
              {["🖼️", "🌅", "💇", "🪞", "✂️", "🧴"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="pic roll"
                  onClick={() => openImportSheet(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="btn btn-green" onClick={() => setView("edit")}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function TypeView() {
  const { post, updatePost, setView } = useRamp();
  if (!post) return null;

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Post type" onBack={() => setView("edit")} />
        <div className="seg">
          {POST_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={post.type === type ? "on" : ""}
              onClick={() =>
                updatePost(markEditStep({ ...post, type }, "type", type !== "Curiosity"))
              }
            >
              {type}
            </button>
          ))}
        </div>
        <p className="helptxt">
          Curiosity is the locked default. Switching changes the caption template + layout.
        </p>
        <button type="button" className="btn btn-green" onClick={() => setView("edit")}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function BackgroundView() {
  const { post, updatePost, setView } = useRamp();
  if (!post) return null;

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Background" onBack={() => setView("edit")} />
        <p className="helptxt">
          Saved default pre-selected. Tap to choose. Subject is composited on top, undistorted.
        </p>
        <div className="grid">
          {BG_PRESETS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              className={`pic ${bg.tone}${post.backgroundId === bg.id ? " sel" : ""}`}
              onClick={() =>
                updatePost(markEditStep({ ...post, backgroundId: bg.id }, "bg", bg.id !== "bg1"))
              }
            >
              {bg.emoji}
            </button>
          ))}
          <div className="pic roll" style={{ fontSize: 22, color: "#666" }}>
            +
          </div>
        </div>
        <button type="button" className="btn btn-green" onClick={() => setView("edit")}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function TagsView() {
  const { post, updatePost, setView } = useRamp();
  const [newTag, setNewTag] = useState("");
  if (!post) return null;

  const toggle = (id) => {
    const tags = post.tags.map((tag) =>
      tag.id === id ? { ...tag, on: !tag.on } : tag,
    );
    updatePost(markEditStep({ ...post, tags }, "tags", true));
  };

  const remove = (id) => {
    const tags = post.tags.filter((tag) => tag.id !== id);
    updatePost(markEditStep({ ...post, tags }, "tags", true));
  };

  const add = () => {
    let value = newTag.trim();
    if (!value) return;
    if (!/^[#@]/.test(value)) value = `#${value.replace(/\s+/g, "")}`;
    const tags = [...post.tags, { id: `t-${Date.now()}`, label: value, on: true }];
    updatePost(markEditStep({ ...post, tags }, "tags", true));
    setNewTag("");
  };

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Tags & attribution" onBack={() => setView("edit")} />
        <div className="tag-edit">
          {post.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`te${tag.on ? " on" : ""}`}
              onClick={() => toggle(tag.id)}
            >
              {tag.label}
              <i
                className="tagx"
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(tag.id);
                }}
              >
                ×
              </i>
            </button>
          ))}
        </div>
        <div className="addrow">
          <input
            value={newTag}
            placeholder="#hashtag or @handle"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button type="button" className="addbtn" onClick={add}>
            Add
          </button>
        </div>
        <button type="button" className="btn btn-green" onClick={() => setView("edit")}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function LinksView() {
  const { post, updatePost, setView } = useRamp();
  if (!post) return null;

  const updateUrl = (id, url) => {
    const links = post.links.map((link) => (link.id === id ? { ...link, url } : link));
    updatePost(markEditStep({ ...post, links }, "link", true));
  };

  const add = () => {
    const links = [...post.links, { id: `l-${Date.now()}`, url: "", inherited: false }];
    updatePost(markEditStep({ ...post, links }, "link", true));
  };

  const remove = (id) => {
    const links = post.links.filter((link) => link.id !== id);
    updatePost(markEditStep({ ...post, links }, "link", true));
  };

  return (
    <div className="ramp-view">
      <div className="scroll">
        <TopBar title="Referral & links" onBack={() => setView("edit")} />
        <p className="helptxt">Inherited from Stylist profile. Edit, add product links, or remove.</p>
        {post.links.map((link) => (
          <div key={link.id} className="linkitem">
            <input
              className="linkinput"
              value={link.url}
              placeholder="https://product-link.com"
              onChange={(e) => updateUrl(link.id, e.target.value)}
            />
            {link.inherited ? <span className="linktag">INHERITED</span> : null}
            {!link.inherited ? (
              <i className="linkx" role="presentation" onClick={() => remove(link.id)}>
                ×
              </i>
            ) : null}
          </div>
        ))}
        <button type="button" className="addbtn wide" onClick={add}>
          + Add product link
        </button>
        <button type="button" className="btn btn-green" onClick={() => setView("edit")}>
          Apply
        </button>
      </div>
    </div>
  );
}
