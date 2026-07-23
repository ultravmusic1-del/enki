"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Tool } from "@/lib/schemas";
import {
  FINDER_STEPS,
  recommendTools,
  type BudgetPref,
  type FinderAnswers,
  type FinderStep,
  type FinderStepId,
  type PlatformPref,
} from "@/lib/finder";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { Reveal } from "@/components/shared/reveal";
import { FinderResultCard } from "@/components/finder/finder-result-card";
import { cn } from "@/lib/utils";

type Props = {
  tools: Tool[];
  categoryNames: Record<string, string>;
};

// URL <-> answers helpers. Keeps results shareable/bookmarkable.
const PARAM: Record<FinderStepId, string> = {
  category: "use",
  budget: "budget",
  platform: "platform",
};

function readAnswers(params: URLSearchParams): FinderAnswers {
  const category = params.get(PARAM.category) ?? undefined;
  const budget = params.get(PARAM.budget) as BudgetPref | null;
  const platform = params.get(PARAM.platform) as PlatformPref | null;
  return {
    category: category && category !== "any" ? category : undefined,
    budget: budget ?? undefined,
    platform: platform ?? undefined,
  };
}

export function OracleFinder({ tools, categoryNames }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categoryNameMap = useMemo(
    () => new Map(Object.entries(categoryNames)),
    [categoryNames],
  );

  // If the URL already carries answers (shared link), jump straight to results.
  const initial = useMemo(() => readAnswers(searchParams), [searchParams]);
  const hasInitial = Boolean(
    initial.category || initial.budget || initial.platform,
  );

  const [answers, setAnswers] = useState<FinderAnswers>(initial);
  const [stepIndex, setStepIndex] = useState(
    hasInitial ? FINDER_STEPS.length : 0,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  const showResults = stepIndex >= FINDER_STEPS.length;

  const results = useMemo(
    () =>
      showResults ? recommendTools(tools, answers, categoryNameMap, 3) : [],
    [showResults, tools, answers, categoryNameMap],
  );

  const focusHeading = () =>
    requestAnimationFrame(() => headingRef.current?.focus());

  const choose = (stepId: FinderStepId, value: string) => {
    const next: FinderAnswers = { ...answers };
    if (stepId === "category")
      next.category = value === "any" ? undefined : value;
    if (stepId === "budget") next.budget = value as BudgetPref;
    if (stepId === "platform")
      next.platform = value === "any" ? undefined : (value as PlatformPref);
    setAnswers(next);

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    focusHeading();

    // On completion, reflect answers to the URL (shallow, no scroll jump).
    if (nextIndex >= FINDER_STEPS.length) {
      const params = new URLSearchParams();
      if (next.category) params.set(PARAM.category, next.category);
      if (next.budget) params.set(PARAM.budget, next.budget);
      if (next.platform) params.set(PARAM.platform, next.platform);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const back = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    focusHeading();
  };

  const restart = () => {
    setAnswers({});
    setStepIndex(0);
    router.replace(pathname, { scroll: false });
    focusHeading();
  };

  const chosenCategory = answers.category;
  const currentStep = FINDER_STEPS[stepIndex];

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col">
        {/* Masthead */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="emblem size-10"
            style={{ color: "var(--brand-teal)" }}
            aria-hidden
          />
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Ask the Oracle
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            Find the right AI tool
          </h1>
          <p className="max-w-md text-pretty text-muted-foreground">
            Answer three quick questions and the Oracle will name the tools
            worth your trust.
          </p>
        </div>

        {/* Progress */}
        {!showResults && (
          <div
            className="mt-10 flex items-center justify-center gap-2"
            aria-hidden
          >
            {FINDER_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stepIndex
                    ? "w-8 bg-teal"
                    : i < stepIndex
                      ? "w-4 bg-teal/50"
                      : "w-4 bg-border",
                )}
              />
            ))}
          </div>
        )}

        <div className="mt-8">
          {showResults ? (
            <section aria-live="polite">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">
                  The Oracle recommends
                </p>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-2xl font-semibold outline-none"
                >
                  Your top {results.length} matches
                </h2>
              </div>

              <div className="mt-8 flex flex-col gap-5">
                {results.map((r, i) => (
                  <Reveal key={r.tool.slug} index={Math.min(i, 4)}>
                    <FinderResultCard
                      tool={r.tool}
                      categoryName={categoryNameMap.get(r.tool.categorySlug)}
                      reasons={r.reasons}
                    />
                  </Reveal>
                ))}
              </div>

              <div className="mt-10 flex flex-col items-center gap-4">
                {chosenCategory && (
                  <Link
                    href={`/tools?cat=${chosenCategory}`}
                    className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
                  >
                    See all {categoryNameMap.get(chosenCategory)} tools
                    <Icon name="ArrowRight" className="size-3.5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                >
                  <Icon name="RotateCcw" className="size-4" />
                  Start over
                </button>
              </div>
            </section>
          ) : (
            <FinderStepView
              key={currentStep.id}
              step={currentStep}
              index={stepIndex}
              total={FINDER_STEPS.length}
              selected={
                currentStep.id === "category"
                  ? (answers.category ?? "any")
                  : currentStep.id === "budget"
                    ? answers.budget
                    : (answers.platform ?? "any")
              }
              headingRef={headingRef}
              onChoose={(value) => choose(currentStep.id, value)}
              onBack={stepIndex > 0 ? back : undefined}
            />
          )}
        </div>
      </div>
    </Container>
  );
}

function FinderStepView({
  step,
  index,
  total,
  selected,
  headingRef,
  onChoose,
  onBack,
}: {
  step: FinderStep;
  index: number;
  total: number;
  selected?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onChoose: (value: string) => void;
  onBack?: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {step.eyebrow} · {index + 1} of {total}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold outline-none sm:text-3xl"
        >
          {step.title}
        </h2>
      </div>

      <div
        role="radiogroup"
        aria-label={step.title}
        className="mt-8 grid gap-3 sm:grid-cols-2"
      >
        {step.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChoose(opt.value)}
              className={cn(
                "group flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-glow-sm",
                isSelected
                  ? "border-teal/50 bg-teal/5 ring-1 ring-teal/30"
                  : "border-border bg-card",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal ring-1 ring-teal/20">
                <Icon name={opt.icon} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold">
                  {opt.label}
                </span>
                <span className="block text-sm text-pretty text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {onBack && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="ArrowLeft" className="size-4" />
            Back
          </button>
        </div>
      )}
    </div>
  );
}
