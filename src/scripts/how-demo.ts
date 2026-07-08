type Phase = "paste" | "generate" | "review";
type StageState = "pending" | "current" | "done";
type StageId = "standards" | "submit" | "hpi" | "impression" | "recs";
type SectionId = "hpi" | "impression" | "recs";

interface Frame {
    phase: Phase;
    stages: Record<StageId, StageState>;
    sections: SectionId[];
    caret: SectionId | null;
    holdMs: number;
}

const TIMELINE: Frame[] = [
    {
        phase: "paste",
        stages: { standards: "pending", submit: "pending", hpi: "pending", impression: "pending", recs: "pending" },
        sections: [],
        caret: null,
        holdMs: 2400,
    },
    {
        phase: "generate",
        stages: { standards: "current", submit: "pending", hpi: "pending", impression: "pending", recs: "pending" },
        sections: [],
        caret: null,
        holdMs: 900,
    },
    {
        phase: "generate",
        stages: { standards: "done", submit: "current", hpi: "pending", impression: "pending", recs: "pending" },
        sections: [],
        caret: null,
        holdMs: 900,
    },
    {
        phase: "generate",
        stages: { standards: "done", submit: "done", hpi: "current", impression: "pending", recs: "pending" },
        sections: ["hpi"],
        caret: "hpi",
        holdMs: 1900,
    },
    {
        phase: "generate",
        stages: { standards: "done", submit: "done", hpi: "done", impression: "current", recs: "pending" },
        sections: ["hpi", "impression"],
        caret: "impression",
        holdMs: 1900,
    },
    {
        phase: "generate",
        stages: { standards: "done", submit: "done", hpi: "done", impression: "done", recs: "current" },
        sections: ["hpi", "impression", "recs"],
        caret: "recs",
        holdMs: 1900,
    },
    {
        phase: "review",
        stages: { standards: "done", submit: "done", hpi: "done", impression: "done", recs: "done" },
        sections: ["hpi", "impression", "recs"],
        caret: null,
        holdMs: 0,
    },
];

const demo = document.getElementById("how-demo");
const steps = document.getElementById("how-steps");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let timer: ReturnType<typeof setTimeout> | undefined;
let hasAutoPlayed = false;

function render(frame: Frame): void {
    if (!demo) return;
    demo.dataset.phase = frame.phase;

    for (const [id, state] of Object.entries(frame.stages)) {
        const stage = demo.querySelector(`[data-stage="${id}"]`);
        stage?.classList.toggle("is-done", state === "done");
        stage?.classList.toggle("is-current", state === "current");
        stage?.classList.toggle("is-pending", state === "pending");
    }

    for (const section of demo.querySelectorAll<HTMLElement>("[data-section]")) {
        const id = section.dataset.section as SectionId;
        section.classList.toggle("is-visible", frame.sections.includes(id));
        section.classList.toggle("has-caret", frame.caret === id);
    }

    for (const button of steps?.querySelectorAll<HTMLElement>("[data-phase-btn]") ?? []) {
        const active = button.dataset.phaseBtn === frame.phase;
        button.classList.toggle("is-active", active);
        if (active) {
            button.setAttribute("aria-current", "true");
        } else {
            button.removeAttribute("aria-current");
        }
    }
}

function play(fromPhase: Phase = "paste"): void {
    if (!demo) return;
    clearTimeout(timer);
    demo.classList.add("is-animating");

    const start = TIMELINE.findIndex((frame) => frame.phase === fromPhase);
    const step = (index: number): void => {
        const frame = TIMELINE[index];
        if (!frame) return;
        render(frame);
        if (index < TIMELINE.length - 1) {
            timer = setTimeout(() => step(index + 1), frame.holdMs);
        } else {
            demo.classList.remove("is-animating");
        }
    };
    step(start === -1 ? 0 : start);
}

if (demo && steps) {
    steps.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>("[data-phase-btn]");
        const phase = button?.dataset.phaseBtn as Phase | undefined;
        if (!phase) return;
        if (reducedMotion.matches) {
            // No playback under reduced motion: show that phase's first frame as a still.
            const frame = TIMELINE.find((f) => f.phase === phase);
            if (frame) render(frame);
        } else {
            play(phase);
        }
    });

    if (!reducedMotion.matches && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (hasAutoPlayed) return;
                if (entries.some((entry) => entry.isIntersecting)) {
                    hasAutoPlayed = true;
                    observer.disconnect();
                    play();
                }
            },
            { threshold: 0.35 },
        );
        observer.observe(demo);
    }
}
