import { getAllTrends } from '@/lib/actions';
import type { Trend } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ListChecks } from 'lucide-react';
import { format } from 'date-fns';

export const metadata = {
  title: 'All Trends | TweetStorm',
  description: 'Browse all available tweet trends on TweetStorm.',
};

export default async function AllTrendsPage() {
  const trends = await getAllTrends();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">All Trends</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Explore all the tweet storms created on our platform.
        </p>
      </header>

      {trends.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No public trends available at the moment. Check back later!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trends.map((trend: Trend) => (
            <Card key={trend.id} className="flex flex-col hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="truncate text-xl">{trend.title}</CardTitle>
                <CardDescription className="text-base">{trend.hashtag}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <ListChecks className="w-4 h-4 mr-2 text-primary" />
                  <span>{trend.tweets.length} tweet{trend.tweets.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarDays className="w-4 h-4 mr-2 text-primary" />
                  <span>Created: {format(new Date(trend.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild variant="default" size="sm" className="w-full">
                  <Link href={`/trends/${trend.routeName}`}>
                    View Trend <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
