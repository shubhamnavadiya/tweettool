
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { trends } from './data';
import type { Trend, Tweet } from './types';
import { revalidatePath } from 'next/cache';

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginAction(prevState: any, formData: FormData) {
  try {
    const validatedFields = LoginSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Invalid credentials.',
      };
    }

    // Mock authentication
  } catch (error) {
    return { message: 'Login failed. Please try again.' };
  }
  redirect('/admin/dashboard');
}


const TrendSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  hashtag: z.string().min(2, 'Hashtag must be at least 2 characters').startsWith('#', 'Hashtag must start with #'),
  routeName: z.string()
    .trim()
    .toLowerCase()
    .min(3, 'Route name must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Route name can only contain lowercase letters, numbers, and hyphens.')
    .transform(val => val.trim().toLowerCase()), // Ensure it's stored trimmed and lowercase
  tweetFile: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'Tweet file is required.')
    .refine((file) => file.type === 'text/plain', 'File must be a .txt file.')
    .refine((file) => file.size < 5 * 1024 * 1024, 'File size must be less than 5MB.'),
});

export async function createTrendAction(prevState: any, formData: FormData) {
  const validatedFields = TrendSchema.safeParse({
    title: formData.get('title'),
    hashtag: formData.get('hashtag'), // Main hashtag for the trend (e.g. user input)
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
    const specificTweetHashtag = '#ViksitGujaratGreenGujarat'; // The hashtag to append/ensure for each tweet
    
    const processedTweetContents: string[] = [];
    
    // Regex to find content blocks ending with the specificTweetHashtag
    // (.*?) non-greedy match for any character including newline
    // #ViksitGujaratGreenGujarat literal match for the hashtag
    // 'g' for global search, 's' for dotall (so '.' matches '\n')
    const regex = new RegExp(`(.*?)${specificTweetHashtag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gs');
    
    let match;
    const matchesFound = [];
    while ((match = regex.exec(fileContent)) !== null) {
        matchesFound.push(match);
        const tweetBody = match[1].trim(); // Content before the hashtag
        if (tweetBody.length > 0) { // Ensure the body is not empty
            processedTweetContents.push(tweetBody + ' ' + specificTweetHashtag);
        }
    }

    // If no matches were found (i.e., specificTweetHashtag was not in the file),
    // treat the entire file content (if not empty) as a single tweet.
    if (matchesFound.length === 0 && fileContent.trim().length > 0) {
        processedTweetContents.push(fileContent.trim() + ' ' + specificTweetHashtag);
    }

    if (processedTweetContents.length === 0) {
       return {
         errors: { tweetFile: ['No valid tweets found. Ensure content exists before #ViksitGujaratGreenGujarat or the file is not empty.'] },
         message: 'Uploaded file contains no processable tweets based on the specified format.',
         success: false,
       };
    }

    const extractedTweets: Tweet[] = processedTweetContents
      .map((content, index) => ({
        id: `${routeName}-tweet-${Date.now()}-${index + 1}`,
        content: content,
      }));

    const newTrend: Trend = {
      id: `trend-${Date.now()}`,
      title,
      hashtag, // This is the trend's main hashtag from the form
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
