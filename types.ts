export type Year = `${number}${number}${number}${number}`;
export type Month = `${0 | 1}${number}`;
export type Day = `${0 | 1 | 2}${number}` | "30" | "31";
export type Hour = `${0}${number}` | "10" | "11" | "12";
export type Minute = `${0 | 1 | 2 | 3 | 4 | 5}${number}`;
export type Second = `${0 | 1 | 2 | 3 | 4 | 5}${number}`;
export type DateString = `${Year}-${Month}-${Day}`;
export type DateTimeString = `${DateString}T${Hour}:${Minute}:${Second}Z`;

export type AtomEntry = {
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

export type Activities = {
  [key in string]?: {
    title: string;
    url: string;
  }[];
};
export type Summary = {
  date: DateString;
  activities: Activities;
};
