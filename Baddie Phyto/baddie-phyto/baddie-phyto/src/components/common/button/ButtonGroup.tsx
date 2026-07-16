import type { ReactNode } from "react";

type ButtonGroupProps = {
  children: ReactNode;
  align?: "left" | "center" | "right" | "between";
  wrap?: boolean;
};

export function ButtonGroup({
  children,
  align = "left",
  wrap = true
}: ButtonGroupProps) {
  const classNames = [
    "dm-ui-button-group",
    `dm-ui-button-group-${align}`,
    wrap ? "dm-ui-button-group-wrap" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classNames}>{children}</div>;
}