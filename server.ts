import { serve } from "std/http/server.ts";
import { sample } from "std/collections/sample.ts";
import { plural } from "plural";
import { sanitize, tagNoVoid as tag } from "tag";

import { EMOJIS, IS_DEV, MESSAGES } from "./constants.ts";
import type { Activities, AtomEntry, DateString, Summary } from "./types.ts";
import { getGithubFeed } from "./get_github_feed.ts";

const getActivities = (entry: AtomEntry) => {
  const eventKey = entry.id.match(":([a-zA-Z]+)Event")?.at(1) || "";
  const titleValue = entry.title.value;
  const repoName = titleValue.replace(/^.* |#.*$/, "");
  const link = entry.links.at(0)?.href || "";
  const repoUrl = `https://github.com/${repoName}`;
  const actUrl = repoUrl;
  const actTitle = repoName;
  if (["Push", "Fork"].includes(eventKey)) {
    return { eventKey, actUrl, actTitle };
  }
  if (eventKey === "Create" || eventKey === "Delete") {
    const actUrl = repoUrl;
    const actTitle = repoName;
    if (titleValue.includes("repository")) {
      return { eventKey: eventKey + "Repository", actUrl, actTitle };
    }
    if (titleValue.includes("branch")) {
      return { eventKey: eventKey + "Branch", actUrl, actTitle };
    }
    if (titleValue.includes("tag")) {
      return { eventKey: eventKey + "Tag", actUrl, actTitle };
    }
  }
  if (eventKey === "IssueComment" || eventKey === "PullRequestReviewComment") {
    const actUrl = link;
    const actTitle = titleValue.replace(/^.* /, "");
    return { eventKey, actUrl, actTitle };
  }
  if (eventKey === "Issues" || eventKey === "PullRequest") {
    const actUrl = link;
    const num = link.match(/\/(issues|pull)\/(\d+)/)?.at(2) || "";
    const actTitle = `${repoName}#${num}`;
    if (titleValue.includes("opened")) {
      return { eventKey: eventKey + "Opened", actUrl, actTitle };
    }
    if (titleValue.includes("closed")) {
      return { eventKey: eventKey + "Closed", actUrl, actTitle };
    }
    if (titleValue.includes("merged")) {
      return { eventKey: eventKey + "Merged", actUrl, actTitle };
    }
  }
  if (eventKey === "Watch") {
    if (titleValue.includes("star")) {
      return { eventKey: "Star", actUrl, actTitle };
    }
    return { eventKey, actUrl, actTitle };
  }

  if (IS_DEV) {
    console.log({ eventKey, titleValue });
  }

  return { eventKey: "Unknown", actUrl, actTitle };
};

const genMainContent = (activities: Activities) => {
  const formatLine = (key: string, unit: string, suffix = "") => {
    const activityList = activities[key];
    if (!activityList) return "";
    const num = activityList.length;
    const links = activityList.map(({ title, url }) =>
      tag("a", { href: url, title }, title)
    ).join(", ");
    return `${num} ${num <= 1 ? unit : plural(unit)} ${suffix}: ${links}`;
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
    `${sample(MESSAGES) || ""} ${sample(EMOJIS) || ""}`,
  ].filter((s) => s !== "").join("<br>");

  return [
    "<![CDATA[",
    tag("div", summary),
    "]]>",
  ];
};

serve(async (request: Request) => {
  const { href, pathname, searchParams } = new URL(request.url);

  if (IS_DEV) {
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

  if (!feedEntries) {
    return new Response("User feed not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  if (IS_DEV) {
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

    const { eventKey, actUrl, actTitle } = getActivities(entry);
    const index = result.findIndex((r) => r.date === date);
    if (index === -1) {
      result.push({
        date,
        activities: {
          [eventKey]: [{ url: actUrl, title: actTitle }],
        },
      });
    } else if (result[index]?.activities[eventKey]) {
      result[index].activities[eventKey]!.push({
        url: actUrl,
        title: actTitle,
      });
    } else {
      result[index].activities[eventKey] = [{ url: actUrl, title: actTitle }];
    }
  }

  // console.log(result);
  const userLink = `https://github.com/${userName}`;
  const description = `${userName}'s daily activities in GitHub`;
  const lastBuildDate = feedEntries.at(0)?.publishedRaw;
  const debugMode = searchParams.get("debug") === "true";

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
      ...result.map(({ date, activities }, idx) =>
        tag(
          "item",
          tag("title", `${description} on ${date}`),
          tag("description", ...genMainContent(activities)),
          tag("link", userLink),
          tag(
            "guid",
            { isPermaLink: "false" },
            idx === 0 && debugMode
              ? `github-recap-feed-${userName}-${new Date().toISOString()}`
              : `github-recap-feed-${userName}-${date}`,
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
