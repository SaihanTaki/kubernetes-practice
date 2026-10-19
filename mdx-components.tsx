import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: (props) => <h2 className="mt-10 mb-3 text-xl font-semibold" {...props} />,
  h3: (props) => <h3 className="mt-6 mb-2 font-semibold" {...props} />,
  p: (props) => <p className="my-3 leading-7" {...props} />,
  ul: (props) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
  ol: (props) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  a: (props) => <a className="text-accent underline underline-offset-4" {...props} />,
  code: (props) => <code className="rounded bg-code px-1 py-0.5 font-mono text-[0.9em]" {...props} />,
  pre: (props) => (
    <pre className="my-4 overflow-x-auto rounded-md border border-border bg-code p-4 font-mono text-sm [&_code]:bg-transparent [&_code]:p-0" {...props} />
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
