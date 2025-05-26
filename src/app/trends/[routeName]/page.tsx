
import { getTrendByRouteName } from '@/lib/actions';
import TweetCard from '@/components/trends/tweet-card';
import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TrendPageProps {
  params: {
    routeName: string;
  };
}

export default async function TrendPage({ params }: TrendPageProps) {
  const { routeName: rawRouteName } = params;
  // Ensure the lookup key is consistently processed: trimmed and lowercased
  const routeName = rawRouteName.trim().toLowerCase(); 
  const trend = await getTrendByRouteName(routeName);

  if (!trend) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-4xl font-bold mb-2">Trend Not Found</h1>
        <p className="text-muted-foreground mb-6">
          Sorry, the trend you are looking for ({rawRouteName}) does not exist or could not be found.
        </p>
        <Button asChild>
          <Link href="/">Go back to Homepage</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">{trend.title}</h1>
        <p className="text-2xl text-accent font-semibold">{trend.hashtag}</p>
      </header>

      {trend.tweets.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Tweets Yet!</AlertTitle>
          <AlertDescription>
            This trend currently has no tweets. The admin might be in the process of adding them.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trend.tweets.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} hashtag={trend.hashtag} trendTitle={trend.title} />
          ))}
        </div>
      )}
    </div>
  );
}

// Generate static paths for existing trends (optional, for performance)
// export async function generateStaticParams() {
//   const trends = await getAllTrends(); // You'd need this function in actions.ts
//   return trends.map((trend) => ({
//     routeName: trend.routeName,
//   }));
// }

export async function generateMetadata({ params }: TrendPageProps) {
  const { routeName: rawRouteName } = params;
  // Ensure the lookup key is consistently processed: trimmed and lowercased
  const routeName = rawRouteName.trim().toLowerCase();
  const trend = await getTrendByRouteName(routeName);
  if (!trend) {
    return {
      title: 'Trend Not Found',
    };
  }
  return {
    title: `${trend.title} (${trend.hashtag}) | TweetTrendsTool`,
    description: `View the tweet trend for ${trend.title}. Tweets: ${trend.tweets.length}`,
  };
}
