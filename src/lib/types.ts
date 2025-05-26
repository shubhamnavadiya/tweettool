export interface Tweet {
  id: string;
  content: string;
}

export interface Trend {
  id: string;
  title: string;
  hashtag: string;
  routeName: string; // URL-friendly name
  tweets: Tweet[];
  createdAt: Date;
}
