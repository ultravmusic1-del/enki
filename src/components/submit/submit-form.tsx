"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { submissionFormSchema, type SubmissionValues } from "@/lib/schemas";
import { submitTool } from "@/app/submit/actions";
import { Icon } from "@/components/shared/icon";

type CategoryOption = { slug: string; name: string };

const inputClass =
  "w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-ring/40";

export function SubmitForm({ categories }: { categories: CategoryOption[] }) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: {
      name: "",
      url: "",
      categorySlug: "",
      pitch: "",
      submitterEmail: "",
    },
  });

  const onSubmit = async (values: SubmissionValues) => {
    const res = await submitTool(values);
    if (res.ok) setDone(true);
    else toast.error(res.error ?? "Something went wrong");
  };

  if (done) {
    return (
      <div className="glass ring-hairline rounded-2xl border border-border p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Icon name="BadgeCheck" className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold">
          Thanks — submission received
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          Our editors review every submission before it&apos;s vetted and
          listed. If it&apos;s a fit, you&apos;ll see it in the directory soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="glass ring-hairline flex flex-col gap-4 rounded-2xl border border-border p-6 sm:p-8"
      noValidate
    >
      <Field label="Tool name" error={errors.name?.message}>
        <input
          type="text"
          placeholder="e.g. Acme AI"
          aria-invalid={!!errors.name}
          className={inputClass}
          {...register("name")}
        />
      </Field>

      <Field label="Website" error={errors.url?.message}>
        <input
          type="url"
          placeholder="https://…"
          aria-invalid={!!errors.url}
          className={inputClass}
          {...register("url")}
        />
      </Field>

      <Field label="Category" optional>
        <select className={inputClass} {...register("categorySlug")}>
          <option value="">Not sure</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Why should we cover it?" optional error={errors.pitch?.message}>
        <textarea
          rows={4}
          placeholder="What does it do well, and who is it for?"
          aria-invalid={!!errors.pitch}
          className={inputClass}
          {...register("pitch")}
        />
      </Field>

      <Field
        label="Your email"
        optional
        error={errors.submitterEmail?.message}
      >
        <input
          type="email"
          placeholder="you@company.com — if you'd like a reply"
          aria-invalid={!!errors.submitterEmail}
          className={inputClass}
          {...register("submitterEmail")}
        />
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Submit tool"}
        <Icon name="ArrowRight" className="size-4" />
      </button>
    </form>
  );
}

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
        {optional && <span className="ml-1 opacity-60">(optional)</span>}
      </span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
