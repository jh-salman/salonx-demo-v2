import { useState } from "react";
import { DownloadSimple } from "phosphor-react";

export function buildTitle(name) {
  const trimmed = (name || "Salon X").trim();
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

async function downloadImageUrl(imageUrl, filename) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("fetch failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PosterPreview({
  imageUrl,
  fullScreen = false,
  downloadable = false,
  downloadFilename = "salonx-ramp.png",
  onDownloadError,
}) {
  const [downloading, setDownloading] = useState(false);

  if (!imageUrl) return null;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadImageUrl(imageUrl, downloadFilename);
    } catch {
      onDownloadError?.("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="template-poster-stage">
      <div
        className={`ramp-artifact-preview${fullScreen ? " ramp-artifact-preview--full" : ""}`}
      >
        <img src={imageUrl} alt="" className="ramp-artifact-preview__img" />
        {downloadable ? (
          <button
            type="button"
            className="template-poster__download"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download post as PNG"
            title="Download PNG"
          >
            <DownloadSimple size={14} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
