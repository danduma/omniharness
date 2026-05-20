import React, { JSX } from "react";

// fx.css is a GLOBAL stylesheet — class names are plain strings, not module imports.

type FxOwnProps = {
  as?: keyof JSX.IntrinsicElements;
  effect?: string;
  at?: string;
  duration?: string;
  easing?: string;
};

type FxProps = FxOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, keyof FxOwnProps>;

export const Fx = React.forwardRef<HTMLElement, FxProps>(function Fx(
  { as: Tag = "div" as const, effect, at, duration, easing, className, style, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      {...rest}
      className={["fxPlay", className].filter(Boolean).join(" ")}
      style={{
        ...style,
        "--fx-effect": effect,
        "--fx-at": at,
        "--fx-duration": duration,
        "--fx-easing": easing,
      } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
});

type FxStaggerOwnProps = {
  as?: keyof JSX.IntrinsicElements;
  at?: string;
  stagger?: string;
  effect?: string;
  duration?: string;
  easing?: string;
};

type FxStaggerProps = FxStaggerOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, keyof FxStaggerOwnProps>;

type FxChildProps = {
  className?: string;
  style?: React.CSSProperties;
};

export const FxStagger = React.forwardRef<HTMLElement, FxStaggerProps>(function FxStagger(
  { as: Tag = "div" as const, at, stagger, effect, duration, easing, className, style, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      {...rest}
      className={className}
      style={{
        ...style,
        "--fx-at": at,
        "--fx-stagger": stagger,
        "--fx-effect": effect,
        "--fx-duration": duration,
        "--fx-easing": easing,
      } as React.CSSProperties}
    >
      {React.Children.map(children, (child, i) => {
        if (!React.isValidElement(child)) return child;
        const childElement = child as React.ReactElement<FxChildProps>;
        return React.cloneElement(child as React.ReactElement, {
          className: ["fxStagger", childElement.props.className].filter(Boolean).join(" "),
          style: {
            ...childElement.props.style,
            "--row-i": i,
          } as React.CSSProperties,
        });
      })}
    </Tag>
  );
});

export function FxWords({
  text, at, duration, effect,
}: {
  text: string;
  at?: string;
  duration?: string;
  effect?: string;
}) {
  const words = text.split(/\s+/);
  return (
    <span
      style={{
        "--word-count": words.length,
        "--fx-at": at,
        "--fx-duration": duration,
        "--fx-effect": effect,
      } as React.CSSProperties}
    >
      {words.map((word, i) => (
        <span
          key={i}
          className="fxWord"
          style={{ "--word-i": i } as React.CSSProperties}
        >
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
