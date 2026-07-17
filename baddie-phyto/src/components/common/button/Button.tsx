import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classNames = [
    "dm-ui-button",
    `dm-ui-button-${variant}`,
    `dm-ui-button-${size}`,
    fullWidth ? "dm-ui-button-full" : "",
    loading ? "dm-ui-button-loading" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "処理中..." : children}
    </button>
  );
}