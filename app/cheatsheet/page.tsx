import type { Metadata } from "next";
import { cheatsheet } from "@/content/cheatsheet";
import { Cheatsheet } from "./Cheatsheet";

export const metadata: Metadata = { title: "Cheatsheet" };

export default function CheatsheetPage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold">Cheatsheet</h1>
      <Cheatsheet entries={cheatsheet} />
    </>
  );
}
