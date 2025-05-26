import TrendForm from '@/components/admin/trend-form';
import { getAllTrends } from '@/lib/actions';
import type { Trend } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ExternalLink, CalendarDays, ListChecks } from 'lucide-react';
import { format } from 'date-fns';

export default async function AdminDashboardPage() {
  const trends = await getAllTrends();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your tweet trends and campaigns.</p>
      </div>
      
      <TrendForm />

      {trends.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">Existing Trends</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trends.map((trend: Trend) => (
              <Card key={trend.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate">{trend.title}</CardTitle>
                  <CardDescription>{trend.hashtag}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary" />
                      {trend.tweets.length} tweet{trend.tweets.length === 1 ? '' : 's'}
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      Created: {format(new Date(trend.createdAt), 'PPp')}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/trends/${trend.routeName}`} target="_blank" rel="noopener noreferrer">
                      View Public Page <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}
       {trends.length === 0 && (
          <Card className="mt-6">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No trends created yet. Use the form above to create your first trend.</p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
