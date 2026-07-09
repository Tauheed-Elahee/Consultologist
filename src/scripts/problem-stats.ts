// Count the Problem-section stat values up from zero, once, when they scroll
// into view. Markup ships the final values, so no JS or reduced motion means
// the numbers are simply already correct.

const values = [...document.querySelectorAll<HTMLElement>(".problem-stat-value[data-count-to]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (values.length > 0 && !reducedMotion.matches && "IntersectionObserver" in window) {
    const countUp = (el: HTMLElement): void => {
        const target = Number(el.dataset.countTo);
        const suffix = el.dataset.suffix ?? "";
        if (!Number.isFinite(target)) return;

        const durationMs = 900;
        const start = performance.now();
        const tick = (now: number): void => {
            const progress = Math.min((now - start) / durationMs, 1);
            const eased = 1 - (1 - progress) ** 3;
            el.textContent = `${Math.round(target * eased)}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    const played = new WeakSet<HTMLElement>();
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const el = entry.target as HTMLElement;
                if (!entry.isIntersecting || played.has(el)) continue;
                played.add(el);
                observer.unobserve(el);
                countUp(el);
            }
        },
        { threshold: 0.5 },
    );
    values.forEach((el) => observer.observe(el));
}

export {};
