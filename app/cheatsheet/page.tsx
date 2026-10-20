import type { Metadata } from "next";
import { chapters } from "@/content/chapters";
import { cheatsheet } from "@/content/cheatsheet";
import { Cheatsheet } from "./Cheatsheet";

export const metadata: Metadata = { title: "Cheatsheet" };

// Only slugs and titles go to the browser, not the chapter data.
const chapterTitles = Object.fromEntries(chapters.filter((c) => c.ready).map((c) => [c.slug, c.title]));

export default function CheatsheetPage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold">Cheatsheet</h1>
      <Cheatsheet entries={cheatsheet} chapterTitles={chapterTitles} />
    </>
  );
}
