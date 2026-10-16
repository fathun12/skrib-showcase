"use client";

import { HOVER_REVEAL } from "@/features/pin/PostCardMenuConnected";
import { ProfileMenu, type ProfileMenuItem } from "@/ui/profile/ProfileMenu";
import { tagLabel } from "@/ui/tags";
import { useForYouItem } from "./ForYouItem";

type Props = {
  author: { username: string; name: string };
  // The first topic of the story, if it has one.
  topic: string | null;
};

function short(name: string): string {
  return name.length > 24 ? `${name.slice(0, 23).trimEnd()}...` : name;
}

// The "..." menu of a story card on the For you tab.
export function ForYouMenu({ author, topic }: Props) {
  const item = useForYouItem();
  if (!item) return null;

  const items: ProfileMenuItem[] = [
    {
      label: `Hide stories from ${short(author.name)}`,
      onSelect: () =>
        item.hide({
          kind: "author",
          username: author.username,
          name: author.name,
        }),
    },
  ];
  if (topic) {
    items.push({
      label: `Hide stories about ${tagLabel(topic)}`,
      onSelect: () =>
        item.hide({ kind: "topic", tag: topic, name: tagLabel(topic) }),
    });
  }

  return (
    <ProfileMenu items={items} label="Story options" className={HOVER_REVEAL} />
  );
}