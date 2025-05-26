
'use client';

import { createTrendAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { UploadCloud, Hash, Link as LinkIcon, ListPlus, AlertCircle, AtSign } from 'lucide-react'; // Added AtSign
import { useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full md:w-auto" disabled={pending} aria-disabled={pending}>
      <ListPlus className="mr-2 h-4 w-4" />
      {pending ? 'Creating Trend...' : 'Create Trend'}
    </Button>
  );
}

export default function TrendForm() {
  const initialState = { message: null, errors: {}, success: false, newTrendRoute: null };
  const [state, dispatch] = useActionState(createTrendAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      toast({
        variant: state.success ? 'default' : 'destructive',
        title: state.success ? 'Success' : 'Error',
        description: state.message,
        action: state.success && state.newTrendRoute ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={state.newTrendRoute!}>View Trend</Link>
          </Button>
        ) : undefined,
      });
      if (state.success) {
        formRef.current?.reset(); // Reset form on success
      }
    }
  }, [state, toast]);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
          <ListPlus /> Create New Trend
        </CardTitle>
        <CardDescription>
          Define a new trend, its hashtag, a unique route, upload your tweets, and optionally add tag handles.
        </CardDescription>
      </CardHeader>
      <form action={dispatch} ref={formRef}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-1"><ListPlus className="w-4 h-4 text-muted-foreground" />Trend Title</Label>
              <Input id="title" name="title" placeholder="e.g., My Awesome Product Launch" required aria-describedby="title-error"/>
              {state?.errors?.title && <p id="title-error" className="text-sm text-destructive">{state.errors.title.join(', ')}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hashtag" className="flex items-center gap-1"><Hash className="w-4 h-4 text-muted-foreground" />Hashtag</Label>
              <Input id="hashtag" name="hashtag" placeholder="#MyProduct" required aria-describedby="hashtag-error"/>
              {state?.errors?.hashtag && <p id="hashtag-error" className="text-sm text-destructive">{state.errors.hashtag.join(', ')}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="routeName" className="flex items-center gap-1"><LinkIcon className="w-4 h-4 text-muted-foreground" />Route Name (URL)</Label>
            <Input id="routeName" name="routeName" placeholder="my-product-launch (no spaces, lowercase)" required aria-describedby="routeName-error"/>
            <p className="text-xs text-muted-foreground">This will be part of the URL (e.g., /trends/your-route-name). Use lowercase letters, numbers, and hyphens only.</p>
            {state?.errors?.routeName && <p id="routeName-error" className="text-sm text-destructive">{state.errors.routeName.join(', ')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagHandles" className="flex items-center gap-1"><AtSign className="w-4 h-4 text-muted-foreground" />Tag Handles (Optional)</Label>
            <Input id="tagHandles" name="tagHandles" placeholder="e.g., @user1, @another_handle" aria-describedby="tagHandles-error"/>
            <p className="text-xs text-muted-foreground">Comma-separated Twitter handles (e.g., @user1, @user2). These will be appended to each tweet.</p>
            {state?.errors?.tagHandles && <p id="tagHandles-error" className="text-sm text-destructive">{state.errors.tagHandles.join(', ')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tweetFile" className="flex items-center gap-1"><UploadCloud className="w-4 h-4 text-muted-foreground" />Upload Tweets File (.txt)</Label>
            <Input id="tweetFile" name="tweetFile" type="file" accept=".txt" required className="pt-1.5" aria-describedby="tweetFile-error"/>
            {state?.errors?.tweetFile && <p id="tweetFile-error" className="text-sm text-destructive">{state.errors.tweetFile.join(', ')}</p>}
          </div>
           {state?.message && !state.success && state.errors && Object.keys(state.errors).length === 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {state.message}
              </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
