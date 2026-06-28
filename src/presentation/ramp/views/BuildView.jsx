import { useCallback, useEffect } from "react";
import { isRampApiAvailable } from "../../../data/rampApi";
import {
  clearRampGenError,
  reconcileRampGenWithPost,
  startRampImageGeneration,
  useRampGenResultApplier,
  useRampGeneration,
} from "../../../data/rampGenerationStore.js";
import { deriveRampStatus, RAMP_STATUS } from "../../../data/rampStatus.js";
import { TopBar, RampGeneratingOverlay, RampPublicLink, RampStatusBadge, RampStatusRail } from "../components";
import { useRamp } from "../rampContext";
import { isRampServerPostId } from "../rampPaths";
import { buildTitle } from "../rampPostModel";
import PosterPreview from "../PosterPreview";

export default function BuildView() {
  const { post, updatePost, showToast, exitBuild } = useRamp();
  const apiOk = isRampApiAvailable();

  const gen = useRampGeneration(post?.id, post?.genState);
  useRampGenResultApplier(post, updatePost);

  const hasGenerated = Boolean(post?.generatedImage);
  const isDone = hasGenerated && post?.buildPhase === "ship" && !gen.isGenerating;
  const isGenerating = gen.isGenerating;

  useEffect(() => {
    reconcileRampGenWithPost(post);
  }, [post?.id, post?.generatedImage, post?.generatedImages]);
  const isStationBuild = post?.source === "station";
  const displayImage = isDone ? post.generatedImage : post?.heroImage;
  const showCaptureEmpty = !displayImage && !isStationBuild;

  const handlePromptChange = useCallback(
    (event) => {
      if (isGenerating) return;
      const caption = event.target.value;
      updatePost({ ...post, caption });
    },
    [isGenerating, post, updatePost],
  );

  const handleGenerate = useCallback(async () => {
    if (!apiOk) {
      showToast("API is not configured.");
      return;
    }
    if (isGenerating) return;

    clearRampGenError(post?.id);

    try {
      await startRampImageGeneration(post);
      showToast("Generating image…");
    } catch (err) {
      showToast(err?.message || "Generation failed");
    }
  }, [apiOk, isGenerating, post, showToast]);

  const handleShip = useCallback(() => {
    showToast("Coming soon");
  }, [showToast]);

  if (!post) return null;

  const genError = gen.isError && !hasGenerated ? gen.error : "";
  const rampStatus = deriveRampStatus({
    status: post.status,
    genState: post.genState,
    generatedImages: post.generatedImages,
    postId: post.id,
    isLocalGenerating: gen.isGenerating,
  });

  return (
    <div className="ramp-view build-view ramp-compose">
      <RampGeneratingOverlay
        show={isGenerating}
        rampStatus={RAMP_STATUS.GENERATING}
        previewUrl={post?.heroImage}
        title={buildTitle(post.target?.name)}
        hint={post.target?.sub}
        onBack={() => exitBuild()}
      />
      <div className="scroll">
        <TopBar
          title={buildTitle(post.target?.name)}
          onBack={() => exitBuild()}
          hint={post.target?.sub}
        />

        {isDone ? (
          <>
            <PosterPreview imageUrl={post.generatedImage} fullScreen downloadable />
            {post.id && isRampServerPostId(post.id) && post.generatedImage ? (
              <RampPublicLink
                queueId={post.id}
                onCopy={(message) => showToast(message || "Link copied")}
              />
            ) : null}
            <div className="ramp-compose-panel ramp-compose-panel--done">
              <RampStatusBadge status={RAMP_STATUS.READY} />
              <div className="btn-split build-ship-actions build-ship-actions--compact">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleShip}
                >
                  Salon posts it
                </button>
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={handleShip}
                >
                  Send to client
                </button>
              </div>
            </div>
          </>
        ) : displayImage ? (
          <div className={`ramp-upload ramp-upload--filled${isGenerating ? " ramp-upload--generating" : ""}`}>
            <img src={displayImage} alt="" className="ramp-upload__photo" />
          </div>
        ) : (
          <div className="ramp-upload ramp-upload--empty">
            <div className="ramp-upload__empty-icon" aria-hidden>
              📷
            </div>
            <p className="ramp-upload__empty-title">No photo</p>
            <p className="ramp-upload__empty-sub">Capture from queue or station first</p>
          </div>
        )}

        {!isDone && !isGenerating ? (
          <div className="ramp-compose-panel">
            <div className="ramp-compose-status">
              <RampStatusBadge status={rampStatus} />
              <RampStatusRail active={rampStatus} />
            </div>
            <div className="field-lbl">Prompt</div>
            <div className="smartfield smartfield--area">
              <textarea
                value={post.caption || ""}
                onChange={handlePromptChange}
                placeholder="Describe the branded post to generate…"
                rows={4}
                disabled={isGenerating}
              />
            </div>
          </div>
        ) : null}

        {isGenerating ? (
          <p className="ramp-compose-hint ramp-compose-hint--center">
            Generation in progress — return anytime to see the result.
          </p>
        ) : null}

        {genError ? <p className="build-gen-status is-error">{genError}</p> : null}
      </div>

      {!isDone && !isGenerating ? (
        <div className="ramp-compose-footer">
          <button
            type="button"
            className="btn btn-primary btn-generate"
            onClick={handleGenerate}
            disabled={!apiOk}
          >
            Generate image
          </button>
        </div>
      ) : null}
    </div>
  );
}
