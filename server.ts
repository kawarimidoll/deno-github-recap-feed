import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { sample } from "https://deno.land/std@0.192.0/collections/sample.ts";
import { plural } from "https://deno.land/x/deno_plural@2.0.0/mod.ts";
import {
  sanitize,
  tagNoVoid as tag,
} from "https://deno.land/x/markup_tag@0.4.0/mod.ts";
import {
  Atom,
  Feed,
  FeedType,
  parseFeed,
} from "https://deno.land/x/rss@0.5.8/mod.ts";

const messages = [
  "All right!",
  "Excellent!",
  "Go for it!",
  "Good job!",
  "Happy hacking!",
  "Keep going!",
  "Keep it up!",
  "Nice work!",
  "Super-duper!",
  "That's it!",
  "That's the way!",
  "Way to go!",
  "You are awesome!",
  "You are doing great!",
  "You are unstoppable!",
  "You can do it!",
  "You've got this!",
];

// deno-fmt-ignore
const emojis = [
  "👏", "👊", "👍", "👌", "🤙", "🎉", "🎊", "🔥", "🚀",
  "🤩", "🥳", "🤗", "🤟", "🏆", "🎖️", "✨", "🌟", "🌠",
  "🌈", "💖", "💘", "💝", "💞", "💟", "💌", "💓", "💕",
];

type Year = `${number}${number}${number}${number}`;
type Month = `${0 | 1}${number}`;
type Day = `${0 | 1 | 2 | 3}${number}`;
type Hour = `${0 | 1}${number}`;
type Minute = `${0 | 1 | 2 | 3 | 4 | 5}${number}`;
type Second = `${0 | 1 | 2 | 3 | 4 | 5}${number}`;
type DateString = `${Year}-${Month}-${Day}`;
type DateTimeString = `${DateString}T${Hour}:${Minute}:${Second}Z`;

type AtomEntry = {
  // event id (e.g. 'tag:github.com,2008:SampleEvent/1234567890')
  id: string;
  // published date
  publishedRaw: DateTimeString;
  // updated date
  updatedRaw: DateTimeString;
  title: {
    // event description (e.g. 'kawarimidoll pushed to master in kawarimidoll/kawarimidoll')
    value: string;
    // 'html'
    type: string;
  };
  // other data
  [key: string]: unknown;
};

type Summary = {
  date: DateString;
  activities: {
    [key in string]?: number;
  };
};

const isAtom = (feed: Feed): feed is Atom => {
  return feed.type === FeedType.Atom;
};

const getGithubFeed = async (userName: string): Promise<AtomEntry[]> => {
  const response = await fetch(`https://github.com/${userName}.atom`);
  const xml = await response.text();
  const feed = await parseFeed(xml) as Atom;

  if (!isAtom(feed)) {
    return [];
  }
  return feed.entries || [];
};
const getEventKey = (entry: AtomEntry): string => {
  const { id, title: { value } } = entry;
  const eventKey = id.split("/")[0].split(":")[2].replace("Event", "");
  if (
    ["Push", "IssueComment", "Fork", "PullRequestReviewComment"].includes(
      eventKey,
    )
  ) {
    return eventKey;
  }
  if (eventKey === "Create") {
    if (value.includes("created")) {
      return "CreateRepository";
    }
    if (value.includes("created")) {
      return "CreateBranch";
    }
  }
  if (eventKey === "Delete") {
    if (value.includes("deleted")) {
      return "DeleteRepository";
    }
    if (value.includes("deleted")) {
      return "DeleteBranch";
    }
  }
  if (eventKey === "Issues") {
    if (value.includes("opened")) {
      return "IssuesOpened";
    }
    if (value.includes("closed")) {
      return "IssuesClosed";
    }
  }
  if (eventKey === "PullRequest") {
    if (value.includes("opened")) {
      return "PullRequestOpened";
    }
    if (value.includes("closed")) {
      return "PullRequestClosed";
    }
    if (value.includes("merged")) {
      return "PullRequestMerged";
    }
  }
  if (eventKey === "Watch") {
    if (value.includes("star")) {
      return "Star";
    }
    return eventKey;
  }
  // console.log({ eventKey, value });
  return "Unknown";
};

const formatLine = (num: number, unit: string, suffix = "") => {
  if (num === 0) return "";
  return tag("div", `${num}`, num <= 1 ? unit : plural(unit), suffix);
};

const genMainContent = (activities: { [key in string]?: number }) => {
  const createRepository = activities.CreateRepository || 0;
  const createBranch = activities.CreateBranch || 0;
  const deleteRepository = activities.DeleteRepository || 0;
  const deleteBranch = activities.DeleteBranch || 0;
  const fork = activities.Fork || 0;
  const push = activities.Push || 0;
  const issuesOpened = activities.IssuesOpened || 0;
  const issuesClosed = activities.IssuesClosed || 0;
  const issueComment = activities.IssueComment || 0;
  const pullRequestOpened = activities.PullRequestOpened || 0;
  const pullRequestClosed = activities.PullRequestClosed || 0;
  const pullRequestMerged = activities.PullRequestMerged || 0;
  const pullRequestReviewComment = activities.PullRequestReviewComment || 0;
  const star = activities.Star || 0;
  const watch = activities.Watch || 0;
  const unknown = activities.Unknown || 0;

  return [
    "<![CDATA[",
    tag(
      "div",
      formatLine(createRepository, "repository", `created`),
      formatLine(createBranch, "branch", `created`),
      formatLine(deleteRepository, "repository", `deleted`),
      formatLine(deleteBranch, "branch", `deleted`),
      formatLine(fork, "fork", `created`),
      formatLine(push, "commit", `pushed`),
      formatLine(issuesOpened, "issue", `opened`),
      formatLine(issuesClosed, "issue", `closed`),
      formatLine(pullRequestOpened, "pull request", `opened`),
      formatLine(pullRequestClosed, "pull request", `closed`),
      formatLine(pullRequestMerged, "pull request", `merged`),
      formatLine(issueComment, "time", `commented to issue`),
      formatLine(pullRequestReviewComment, "time", `commented to pull request`),
      formatLine(star, "star", `created`),
      formatLine(watch, "watch", `created`),
      formatLine(unknown, "unknown activity", `found`),
    ),
    tag("div", sample(messages) || "", sample(emojis) || ""),
    "]]>",
  ];
};

const isDev = !Deno.env.get("DENO_DEPLOYMENT_ID");
serve(async (request: Request) => {
  const { href, pathname } = new URL(request.url);

  if (isDev) {
    console.log(pathname);
  }

  if (pathname === "/") {
    const file = await Deno.readFile("./index.html");
    return new Response(file, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }
  if (pathname === "/favicon.ico") {
    return new Response("", {
      headers: { "content-type": "text/plain" },
    });
  }

  const userName = pathname.replace(/^\//, "");
  const feedEntries = await getGithubFeed(userName);

  const todayString = new Date().toISOString().split("T")[0] as DateString;

  const result: Summary[] = [];

  for (const entry of feedEntries) {
    const { publishedRaw } = entry;
    const date = publishedRaw.split("T")[0] as DateString;

    // skip today
    if (date === todayString) {
      continue;
    }

    const eventKey = getEventKey(entry);
    const index = result.findIndex((r) => r.date === date);
    if (index === -1) {
      result.push({
        date,
        activities: {
          [eventKey]: 1,
        },
      });
    } else if (result[index]?.activities[eventKey]) {
      result[index].activities[eventKey]! += 1;
    } else {
      result[index].activities[eventKey] = 1;
    }
  }

  // console.log(result);
  const userLink = `https://github.com/${userName}`;

  const prefix = '<?xml version="1.0" encoding="UTF-8"?>';
  const res = tag(
    "rss",
    {
      version: "2.0",
      "xmlns:content": "http://purl.org/rss/1.0/modules/content/",
      "xmlns:atom": "http://www.w3.org/2005/Atom",
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
      "xmlns:sy": "http://purl.org/rss/1.0/modules/syndication/",
    },
    tag(
      "channel",
      tag("title", `GitHub activities daily summary (${userName})`),
      `<atom:link href="${
        sanitize(href)
      }" rel="self" type="application/rss+xml" />`,
      tag("link", userLink),
      tag("description", `${userName}'s activities in GitHub`),
      tag("lastBuildDate", feedEntries.at(0)?.publishedRaw || ""),
      tag("sy:updatePeriod", "daily"),
      ...result.map(({ date, activities }) =>
        tag(
          "item",
          tag("title", `${userName}'s activities in ${date}`),
          tag("description", ...genMainContent(activities)),
          tag("link", userLink),
          tag("guid", { isPermaLink: "false" }, date),
          tag("pubDate", date),
          tag("dc:creator", userName),
        )
      ),
    ),
  );
  return new Response(prefix + res, {
    headers: { "content-type": "application/xml" },
  });
});
