export type ProjectTimelineState = "completed" | "current" | "pending";

export type ProjectTimelineStep = {
  label: string;
  state: ProjectTimelineState;
};

const LABELS = [
  "Proje oluşturuldu",
  "Teklifler değerlendiriliyor",
  "Uzman seçildi",
  "İş devam ediyor",
  "Tamamlandı",
] as const;

function steps(
  states: ProjectTimelineState[],
): ProjectTimelineStep[] {
  return LABELS.map((label, index) => ({
    label,
    state: states[index] ?? "pending",
  }));
}

export function getProjectTimelineSteps(input: {
  jobStatus: string;
  pendingOfferCount: number;
}): ProjectTimelineStep[] {
  const status = input.jobStatus;
  const hasPending = input.pendingOfferCount > 0;

  if (status === "completed") {
    return steps([
      "completed",
      "completed",
      "completed",
      "completed",
      "current",
    ]);
  }

  if (status === "in_progress") {
    return steps([
      "completed",
      "completed",
      "completed",
      "current",
      "pending",
    ]);
  }

  if (status === "cancelled" || status === "closed") {
    if (hasPending) {
      return steps([
        "completed",
        "current",
        "pending",
        "pending",
        "pending",
      ]);
    }

    return steps([
      "current",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  }

  if (status === "open" && hasPending) {
    return steps([
      "completed",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
  }

  return steps([
    "current",
    "pending",
    "pending",
    "pending",
    "pending",
  ]);
}
