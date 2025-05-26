
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies as nextCookies } from 'next/headers'; // Renamed to avoid conflict
import { trends } from './data';
import type { Trend, Tweet } from './types';
import { revalidatePath } from 'next/cache';

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginAction(prevState: any, formData: FormData) {
  const validatedFields = LoginSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Both username and password are required.',
      success: false,
    };
  }

  const { username, password } = validatedFields.data;

  // Check credentials
  if (username === 'bjp4botad' && password === 'BJP4Botad') {
    // Set auth cookie
    const cookieStore = nextCookies();
    cookieStore.set('auth_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    redirect('/admin/dashboard');
  } else {
    return {
      errors: {}, // No specific field errors, just a general message
      message: 'Invalid username or password.',
      success: false,
    };
  }
}


const TrendSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  hashtag: z.string().min(2, 'Hashtag must be at least 2 characters').startsWith('#', 'Hashtag must start with #'),
  routeName: z.string()
    .trim()
    .toLowerCase()
    .min(3, 'Route name must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Route name can only contain lowercase letters, numbers, and hyphens.')
    .transform(val => val.trim().toLowerCase()),
  tweetFile: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'Tweet file is required.')
    .refine((file) => file.type === 'text/plain', 'File must be a .txt file.')
    .refine((file) => file.size < 5 * 1024 * 1024, 'File size must be less than 5MB.'),
});

export async function createTrendAction(prevState: any, formData: FormData) {
  const validatedFields = TrendSchema.safeParse({
    title: formData.get('title'),
    hashtag: formData.get('hashtag'),
    routeName: formData.get('routeName'),
    tweetFile: formData.get('tweetFile'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create trend. Please check the form.',
      success: false,
    };
  }

  const { title, hashtag, routeName, tweetFile } = validatedFields.data;

  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
      success: false,
    };
  }

  try {
    const fileContent = await tweetFile.text();
    const specificTweetHashtag = '#ViksitGujaratGreenGujarat';
    const tweets: Tweet[] = [];

    // Regex to find content blocks ending with the specificTweetHashtag
    // (.*?) non-greedy match for any character including newline, up to the specific hashtag
    // The 'gs' flags are crucial: 'g' for global, 's' for dotall (so '.' matches '\n')
    const regex = new RegExp(`(.*?)${specificTweetHashtag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\n\\n|$)`, 'gs');
    
    let match;
    const rawTweets = [];
    while ((match = regex.exec(fileContent)) !== null) {
        // match[1] is the content before the hashtag
        const tweetBody = match[1].trim();
        if (tweetBody.length > 0) { // Ensure the body is not empty
            rawTweets.push(`${tweetBody} ${specificTweetHashtag}`);
        }
    }

    // Fallback: if no specific hashtag matches were found, but the file has content,
    // treat the whole file as one tweet, or split by lines if appropriate.
    // For now, let's assume the regex approach is primary. If it yields no tweets,
    // and the file content is not empty and does not contain the hashtag at all,
    // we could treat lines as tweets and append the hashtag.
    // However, the user prompt emphasized "content of before #ViksitGujaratGreenGujarat"

    if (rawTweets.length === 0) {
        // If regex found nothing, it implies the specific format was not met.
        // We might want to check if the file is empty or just doesn't conform.
        // Let's refine this: if rawTweets is empty, but fileContent isn't, it could be an issue.
        // For now, if the regex doesn't find content formatted as "stuff #ViksitGujaratGreenGujarat", it yields no tweets.
        // This fulfills "content of before #ViksitGujaratGreenGujarat".
        // And "take some twite only contain which have #ViksitGujaratGreenGujarat that I want to remove"
        // is handled by `tweetBody.length > 0`.
    }


    if (rawTweets.length === 0 && fileContent.trim().length > 0 && !fileContent.includes(specificTweetHashtag)) {
      // If no hashtag was found at all, and the file is not empty, treat each line as a tweet.
       const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
       lines.forEach(line => {
           rawTweets.push(line.trim() + ' ' + specificTweetHashtag);
       });
    } else if (rawTweets.length === 0 && fileContent.trim().length > 0 && fileContent.trim() === specificTweetHashtag) {
        // File only contains the hashtag, ignore.
         return {
            errors: { tweetFile: ['File only contains the hashtag or is effectively empty.'] },
            message: 'Uploaded file only contains the hashtag or no valid content before it.',
            success: false,
        };
    }


    if (rawTweets.length === 0) {
       return {
         errors: { tweetFile: ['No valid tweets found. Ensure content exists before #ViksitGujaratGreenGujarat and is not just the hashtag.'] },
         message: 'Uploaded file contains no processable tweets based on the specified format.',
         success: false,
       };
    }
    
    const extractedTweets: Tweet[] = rawTweets
      .map((content, index) => ({
        id: `${routeName}-tweet-${Date.now()}-${index + 1}`,
        content: content,
      }));


    const newTrend: Trend = {
      id: `trend-${Date.now()}`,
      title,
      hashtag,
      routeName,
      tweets: extractedTweets,
      createdAt: new Date(),
    };

    trends.unshift(newTrend);

    revalidatePath('/admin/dashboard');
    revalidatePath(`/trends/${routeName}`);
    revalidatePath('/trends');
    
    return { 
        message: `Trend "${title}" created successfully with ${extractedTweets.length} tweets. View at /trends/${routeName}`, 
        success: true, 
        newTrendRoute: `/trends/${routeName}` 
    };

  } catch (error) {
    console.error('Error processing file or creating trend:', error);
    return { 
        message: 'An unexpected error occurred while creating the trend. Please ensure the file is plain text and not too large.', 
        success: false 
    };
  }
}

export async function getTrendByRouteName(routeName: string): Promise<Trend | undefined> {
  const processedRouteName = routeName.trim().toLowerCase();
  return trends.find(trend => trend.routeName === processedRouteName);
}

export async function getAllTrends(): Promise<Trend[]> {
  return [...trends].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const DeleteTrendSchema = z.object({
  trendId: z.string().min(1, 'Trend ID is required'),
});

export async function deleteTrendAction(prevState: any, formData: FormData) {
  const validatedFields = DeleteTrendSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      message: 'Invalid trend ID.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  const { trendId } = validatedFields.data;

  try {
    const trendIndex = trends.findIndex(trend => trend.id === trendId);
    if (trendIndex === -1) {
      return { message: 'Trend not found.', success: false };
    }

    trends.splice(trendIndex, 1);

    revalidatePath('/admin/dashboard');
    revalidatePath('/trends');

    return { message: 'Trend deleted successfully.', success: true };
  } catch (error) {
    console.error('Error deleting trend:', error);
    return { message: 'An unexpected error occurred while deleting the trend.', success: false };
  }
}
