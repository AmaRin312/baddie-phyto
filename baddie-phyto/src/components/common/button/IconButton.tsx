import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type IconButtonSize = "sm" | "md" | "lg";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

export function IconButton({
  label,
  children,
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const classNames = [
    "dm-ui-icon-button",
    `dm-ui-icon-button-${variant}`,
    `dm-ui-icon-button-${size}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classNames}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}