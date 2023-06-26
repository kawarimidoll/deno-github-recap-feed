import { Atom, Feed, FeedType, parseFeed } from "rss";
import type { AtomEntry } from "./types.ts";

const isAtom = (feed: Feed): feed is Atom => {
  return feed.type === FeedType.Atom;
};

export const getGithubFeed = async (userName: string): Promise<AtomEntry[]> => {
  const response = await fetch(`https://github.com/${userName}.atom`);
  const xml = await response.text();
  const feed = await parseFeed(xml) as Atom;

  if (!isAtom(feed)) {
    return [];
  }
  return feed.entries || [];
};
