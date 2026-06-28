import { useNavigate } from "react-router-dom";
import { QueueCard, RampHead, RampQueueLegend, Section } from "../components";
import { useRampItemStatus } from "../../../data/rampStatus.js";
import { useRampS1Queue } from "../../../data/rampLocalQueueStore";
import { rampQueuePath } from "../rampPaths";

function RampQueueCard({ item, onOpen }) {
  const pill = useRampItemStatus(item);

  return (
    <QueueCard
      item={{
        name: item.name,
        meta: item.meta,
        thumb: item.thumb,
        emoji: item.emoji,
        avatar: item.avatar,
        pills: [pill],
      }}
      onClick={() => onOpen(item)}
    />
  );
}

export default function QueueView() {
  const navigate = useNavigate();
  const rampQueue = useRampS1Queue();

  const openQueueItem = (item) => {
    navigate(rampQueuePath(item.postId || item.id));
  };

  return (
    <div className="ramp-view ramp-master-view">
      <div className="scroll">
        <RampHead title="RAMP" sub="Queue" />
        <Section title="Queue" count={rampQueue.length} />
        {rampQueue.length > 0 ? (
          <>
            <RampQueueLegend />
            <p className="hint">Tap a card to open build</p>
          </>
        ) : null}

        {rampQueue.length === 0 ? (
          <p className="hint ramp-empty-hint">
            No captures in queue. Use ⚡ to take a photo or open station.
          </p>
        ) : (
          rampQueue.map((item) => (
            <RampQueueCard key={item.id} item={item} onOpen={openQueueItem} />
          ))
        )}
      </div>
    </div>
  );
}
