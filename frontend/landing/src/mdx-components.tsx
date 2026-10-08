import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

const components: MDXComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mt-12 mb-5 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mt-12 mb-4 font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-8 mb-3 font-display text-xl font-semibold text-ink" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mb-5 text-[17px] leading-relaxed text-muted" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-6 space-y-2 pl-1 text-muted" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-6 list-decimal space-y-2 pl-6 text-muted marker:text-orange-500" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li
      className="relative pl-5 before:absolute before:top-[0.7em] before:left-0 before:size-1.5 before:rounded-full before:bg-orange-500"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-ink" {...props} />
  ),
  a: ({ href = "#", ...props }: ComponentPropsWithoutRef<"a">) => (
    <Link href={href} className="text-orange-400 underline-orange hover:text-orange-300" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="my-8 rounded-card border-l-2 border-orange-500 glass px-6 py-5 text-ink" {...props} />
  ),
  hr: () => <hr className="my-10 border-line" />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
