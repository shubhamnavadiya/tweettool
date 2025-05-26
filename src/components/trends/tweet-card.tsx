'use client';

import type { Tweet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquareText } from 'lucide-react'; // Using MessageSquareText as a stand-in for Twitter bird

interface TweetCardProps {
  tweet: Tweet;
  hashtag: string;
  trendTitle: string;
}

export default function TweetCard({ tweet, hashtag, trendTitle }: TweetCardProps) {
  const handleTweet = () => {
    const tweetText = `${tweet.content} ${hashtag}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <p className="text-foreground mb-4 whitespace-pre-line leading-relaxed">{tweet.content}</p>
        <Button onClick={handleTweet} variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-auto">
          <MessageSquareText className="mr-2 h-5 w-5" />
          Tweet this
        </Button>
      </CardContent>
    </Card>
  );
}
