import type { Trend } from './types';

// In-memory store for trends
export const trends: Trend[] = [];

// Example: Add a sample trend (optional, for testing)
/*
trends.push({
  id: 'sample-trend-1',
  title: 'My Awesome Tech Conference',
  hashtag: '#TechConf2024',
  routeName: 'tech-conf-2024',
  tweets: [
    { id: 't1', content: 'Just arrived at #TechConf2024! So excited for the keynote.' },
    { id: 't2', content: 'Amazing session on Next.js server components. Mind blown! #TechConf2024' },
    { id: 't3', content: 'Networking lunch was great. Met some inspiring folks. #TechConf2024' },
  ],
  createdAt: new Date(),
});
*/
