import {
  getProjectTimelineSteps,
  type ProjectTimelineState,
} from "@/lib/project-timeline";

export function ProjectTimeline({
  jobStatus,
  pendingOfferCount,
}: {
  jobStatus: string;
  pendingOfferCount: number;
}) {
  const items = getProjectTimelineSteps({
    jobStatus,
    pendingOfferCount,
  });

  return (
    <ol className="flex gap-1 overflow-x-auto pb-0.5">
      {items.map((item, index) => (
        <li
          key={item.label}
          className="flex min-w-[4.4rem] flex-1 flex-col items-center"
        >
          <div className="flex w-full items-center">
            <div
              className={`h-px flex-1 ${
                index === 0
                  ? "bg-transparent"
                  : item.state === "pending"
                    ? "bg-zinc-200"
                    : "bg-zinc-400"
              }`}
            />
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${dotClass(
                item.state,
              )}`}
              aria-hidden="true"
            />
            <div
              className={`h-px flex-1 ${
                index === items.length - 1
                  ? "bg-transparent"
                  : items[index + 1]?.state === "pending"
                    ? "bg-zinc-200"
                    : "bg-zinc-400"
              }`}
            />
          </div>

          <p
            className={`mt-1.5 text-center text-[10px] leading-3 ${labelClass(
              item.state,
            )}`}
          >
            {item.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function dotClass(state: ProjectTimelineState) {
  if (state === "current") {
    return "bg-zinc-900 ring-2 ring-zinc-900/15";
  }

  if (state === "completed") {
    return "bg-zinc-700";
  }

  return "bg-zinc-200";
}

function labelClass(state: ProjectTimelineState) {
  if (state === "current") {
    return "font-medium text-zinc-900";
  }

  if (state === "completed") {
    return "text-zinc-600";
  }

  return "text-zinc-400";
}
