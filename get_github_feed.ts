import { Atom, Feed, FeedType, parseFeed } from "rss";
import type { AtomEntry } from "./types.ts";

const isAtom = (feed: Feed): feed is Atom => {
  return feed.type === FeedType.Atom;
};

export const getGithubFeed = async (
  userName: string,
): Promise<AtomEntry[] | null> => {
  const response = await fetch(`https://github.com/${userName}.atom`);
  const xml = await response.text();
  if (!xml || xml === "Not Found") {
    return null;
  }
  const feed = await parseFeed(xml) as Atom;

  if (!isAtom(feed)) {
    return null;
  }
  return feed.entries || [];
};
