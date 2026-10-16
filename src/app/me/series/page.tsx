import { redirect } from "next/navigation";

// Series now live in a tab of /me/posts. Old links and bookmarks land there.
export default function MySeriesPage() {
  redirect("/me/posts?tab=series");
}