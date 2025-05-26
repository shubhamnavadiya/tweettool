
'use client';

import type { Tweet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquareText, CheckCircle } from 'lucide-react'; 
import { useState } from 'react';

interface TweetCardProps {
  tweet: Tweet;
  hashtag: string;
  trendTitle: string;
}

export default function TweetCard({ tweet, hashtag, trendTitle }: TweetCardProps) {
  const [isTweeted, setIsTweeted] = useState(false);

  const handleTweet = () => {
    const tweetText = `${tweet.content}`; // Hashtag is already part of tweet.content from actions.ts
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    setIsTweeted(true);
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <p className="text-foreground mb-4 whitespace-pre-line leading-relaxed">{tweet.content}</p>
        {isTweeted ? (
          <Button 
            variant="default" 
            className="w-full bg-green-600 hover:bg-green-700 text-white mt-auto" 
            disabled
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Tweeted
          </Button>
        ) : (
          <Button 
            onClick={handleTweet} 
            variant="default" 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-auto"
          >
            <MessageSquareText className="mr-2 h-5 w-5" />
            Tweet this
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
