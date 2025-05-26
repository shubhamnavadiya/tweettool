import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import { getAllTrends } from '@/lib/actions';
import type { Trend } from '@/lib/types';

export default async function HomePage() {
  const latestTrends = (await getAllTrends()).slice(0, 3);

  return (
    <div className="flex flex-col items-center text-center space-y-12">
      <section className="mt-8">
        <h1 className="text-5xl font-bold tracking-tight text-primary">
          Welcome to TweetTrendsTool!
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Effortlessly create, manage, and share tweet trends for your campaigns, events, or ideas.
          Upload your list of tweets and let TweetTrendsTool help you spread the word.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/admin/dashboard">
              Admin Dashboard <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/trends">
              View All Trends <ListChecks className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {latestTrends.length > 0 && (
        <section className="w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Latest Trends</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestTrends.map((trend: Trend) => (
              <Card key={trend.id} className="text-left hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="truncate">{trend.title}</CardTitle>
                  <CardDescription>{trend.hashtag}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {trend.tweets.length} tweet{trend.tweets.length === 1 ? '' : 's'}
                  </p>
                  <Button asChild variant="link" className="p-0 h-auto">
                    <Link href={`/trends/${trend.routeName}`}>
                      View Trend <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
