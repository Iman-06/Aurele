import type { ButtonHTMLAttributes } from "react";

type Variant = "add" | "choose";

const VARIANT_CLASS: Record<Variant, string> = {
  add: "btn btn-add",
  choose: "btn btn-choose",
};

const VARIANT_LABEL: Record<Variant, string> = {
  add: "Add",
  choose: "Choose",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "add", className = "", children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...props}>
      {children ?? VARIANT_LABEL[variant]}
    </button>
  );
}
