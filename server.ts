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

const isDev = !Deno.env.get("DENO_DEPLOYMENT_ID");

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
type Day = `${0 | 1 | 2}${number}` | "30" | "31";
type Hour = `${0}${number}` | "10" | "11" | "12";
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
    type: "html";
  };
  content: {
    // event description dom
    value: string;
    type: "html";
  };
  links: {
    href: string;
    rel: "alternate";
    type: "text/html";
  }[];
  // other data
  [key: string]: unknown;
};

type Activities = {
  [key in string]?: number;
};
type Summary = {
  date: DateString;
  activities: Activities;
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
const getActivities = (entry: AtomEntry): string => {
  const eventKey = entry.id.match(":([a-zA-Z]+)Event")?.at(1) || "";
  const titleValue = entry.title.value;
  if (
    ["Push", "IssueComment", "Fork", "PullRequestReviewComment"].includes(
      eventKey,
    )
  ) {
    return eventKey;
  }
  if (eventKey === "Create" || eventKey === "Delete") {
    if (titleValue.includes("repository")) {
      return eventKey + "Repository";
    }
    if (titleValue.includes("branch")) {
      return eventKey + "Branch";
    }
    if (titleValue.includes("tag")) {
      return eventKey + "Tag";
    }
  }
  if (eventKey === "Issues" || eventKey === "PullRequest") {
    if (titleValue.includes("opened")) {
      return eventKey + "Opened";
    }
    if (titleValue.includes("closed")) {
      return eventKey + "Closed";
    }
    if (titleValue.includes("merged")) {
      return eventKey + "Merged";
    }
  }
  if (eventKey === "Watch") {
    if (titleValue.includes("star")) {
      return "Star";
    }
    return eventKey;
  }
  // console.log({ eventKey, titleValue });
  return "Unknown";
};

const genMainContent = (activities: Activities) => {
  const formatLine = (key: string, unit: string, suffix = "") => {
    const num = activities[key] || 0;
    if (num === 0) return "";
    return `${num} ${num <= 1 ? unit : plural(unit)} ${suffix}`;
  };

  const summary = [
    formatLine("CreateRepository", "repository", "created"),
    formatLine("CreateBranch", "branch", "created"),
    formatLine("CreateTag", "tag", "created"),
    formatLine("DeleteRepository", "repository", "deleted"),
    formatLine("DeleteBranch", "branch", "deleted"),
    formatLine("Fork", "fork", "created"),
    formatLine("Push", "time", "pushed"),
    formatLine("IssuesOpened", "issue", "opened"),
    formatLine("IssuesClosed", "issue", "closed"),
    formatLine("PullRequestOpened", "pull request", "opened"),
    formatLine("PullRequestClosed", "pull request", "closed"),
    formatLine("PullRequestMerged", "pull request", "merged"),
    formatLine("IssueComment", "time", "commented"),
    formatLine("PullRequestReviewComment", "time", "reviewed"),
    formatLine("Star", "star", "created"),
    formatLine("Watch", "watch", "created"),
    formatLine("Unknown", "unknown activity ", "found"),
    `${sample(messages) || ""} ${sample(emojis) || ""}`,
  ].filter((s) => s !== "").join("<br>");

  return [
    "<![CDATA[",
    tag("div", summary),
    "]]>",
  ];
};

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
  if (isDev) {
    console.log(
      feedEntries.map(({ id, title, links, content }) => {
        return {
          id,
          title: title.value,
          link: links[0].href,
          content: content.value,
        };
      }),
    );
  }

  const todayString = new Date().toISOString().split("T")[0] as DateString;

  const result: Summary[] = [];

  for (const entry of feedEntries) {
    const { publishedRaw } = entry;
    const date = publishedRaw.split("T")[0] as DateString;

    // skip today
    if (date === todayString) {
      continue;
    }

    const eventKey = getActivities(entry);
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
  const description = `${userName}'s daily activities in GitHub`;
  const lastBuildDate = feedEntries.at(0)?.publishedRaw;

  const prefix = '<?xml version="1.0" encoding="UTF-8"?>';
  const res = tag(
    "rss",
    {
      version: "2.0",
      "xmlns:content": "http://purl.org/rss/1.0/modules/content/",
      "xmlns:atom": "http://www.w3.org/2005/Atom",
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
    },
    tag(
      "channel",
      tag("title", `GitHub Recap Feed (${userName})`),
      `<atom:link href="${
        sanitize(href)
      }" rel="self" type="application/rss+xml" />`,
      tag("link", userLink),
      tag("description", description),
      lastBuildDate ? tag("lastBuildDate", lastBuildDate) : "",
      ...result.map(({ date, activities }) =>
        tag(
          "item",
          tag("title", `${description} on ${date}`),
          tag("description", ...genMainContent(activities)),
          tag("link", userLink),
          tag(
            "guid",
            { isPermaLink: "false" },
            `github-recap-feed-${userName}-${date}`,
          ),
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
