"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { reviewFormSchema, type ReviewFormValues } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";

export function ReviewModal({ toolName }: { toolName: string }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { name: "", rating: 0, title: "", body: "" },
  });

  const onSubmit = (values: ReviewFormValues) => {
    // Client-only demo — no persistence. Acknowledge with a toast.
    toast.success("Thanks for your review", {
      description: `Your ${values.rating}★ review of ${toolName} has been submitted for moderation.`,
    });
    reset();
    setHover(0);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          reset();
          setHover(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Icon name="Star" className="size-4 text-teal" />
          Write a review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Review {toolName}
          </DialogTitle>
          <DialogDescription>
            Share your experience to help others adopt with confidence.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Rating */}
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Label>Your rating</Label>
                <div
                  className="flex items-center gap-1"
                  onMouseLeave={() => setHover(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = (hover || field.value) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHover(star)}
                        onClick={() => field.onChange(star)}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        className="rounded p-0.5 transition-transform hover:scale-110"
                      >
                        <Icon
                          name="Star"
                          className={cn(
                            "size-6 transition-colors",
                            filled
                              ? "fill-teal text-teal"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
                {errors.rating && (
                  <span className="text-xs text-destructive">
                    {errors.rating.message}
                  </span>
                )}
              </div>
            )}
          />

          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-name">Name</Label>
            <Input
              id="review-name"
              placeholder="How should we credit you?"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <span className="text-xs text-destructive">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-title">Title</Label>
            <Input
              id="review-title"
              placeholder="Sum up your experience"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            {errors.title && (
              <span className="text-xs text-destructive">
                {errors.title.message}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-body">Review</Label>
            <Textarea
              id="review-body"
              rows={4}
              placeholder="What did you like or dislike? What would you tell a colleague?"
              aria-invalid={!!errors.body}
              {...register("body")}
            />
            {errors.body && (
              <span className="text-xs text-destructive">
                {errors.body.message}
              </span>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              Submit review
              <Icon name="ArrowRight" className="size-3.5" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
