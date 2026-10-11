"use client";

import { Fragment, startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/(panel)/action-state";
import { btn } from "./ui";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  className?: string;
  submitClassName?: string;
  confirm?: string; // ask before submitting (e.g. deletes)
  /** Change this (e.g. the record's updatedAt) to refill the inputs with fresh saved values,
   *  while keeping the success/error message. */
  resetKey?: string | number;
};

/** A form bound to a Server Action that shows the action's success / error message. */
export function ActionForm({ action, children, submitLabel = "Save", pendingLabel = "Saving…", className, submitClassName = btn, confirm, resetKey }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // React clears a form after every <form action> submit, which would throw away what the owner
  // typed when the save fails. So we submit by hand, and only clear the form after a success.
  useEffect(() => {
    if (state?.message && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <Fragment key={resetKey}>{children}</Fragment>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={submitClassName}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.message && !state.error && (
          <p role="status" className="text-sm text-emerald-700">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
