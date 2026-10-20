import type { MDXComponents } from "mdx/types";

// Prose keeps a readable ~70ch measure; labs, diagrams, and quizzes are separate components and use the full width.
const measure = "max-w-[70ch]";

const components: MDXComponents = {
  h2: (props) => <h2 className={`${measure} mt-16 mb-4 text-2xl font-semibold tracking-tight`} {...props} />,
  h3: (props) => <h3 className={`${measure} mt-8 mb-2 text-lg font-semibold`} {...props} />,
  p: (props) => <p className={`${measure} my-4 leading-[1.75]`} {...props} />,
  ul: (props) => <ul className={`${measure} my-4 list-disc space-y-2 pl-6 leading-[1.75]`} {...props} />,
  ol: (props) => <ol className={`${measure} my-4 list-decimal space-y-2 pl-6 leading-[1.75]`} {...props} />,
  a: (props) => <a className="text-accent underline decoration-1 underline-offset-4 hover:decoration-2" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  code: (props) => <code className="rounded bg-code px-1.5 py-0.5 font-mono text-[0.88em]" {...props} />,
  table: (props) => (
    <div className="my-6 max-w-[70ch] overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-border bg-code px-3 py-2 font-semibold" {...props} />,
  td: (props) => <td className="border-b border-border px-3 py-2 align-top" {...props} />,
  pre: (props) => (
    <pre
      className={`${measure} my-6 overflow-x-auto rounded-lg border border-border bg-code p-4 font-mono text-sm leading-6 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em]`}
      {...props}
    />
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
