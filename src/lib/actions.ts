
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
  hashtag: z.string()
    .min(2, 'Hashtag must be at least 2 characters')
    .startsWith('#', 'Hashtag must start with #')
    .trim(), // Trim the hashtag input
  routeName: z.string()
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

  // Use the validated and transformed data
  const { title, hashtag: dynamicHashtag, routeName, tweetFile } = validatedFields.data;

  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
      success: false,
    };
  }

  try {
    const fileContent = await tweetFile.text();
    const extractedTweets: Tweet[] = [];

    if (fileContent.trim().length === 0) {
        return {
            errors: { tweetFile: ['Uploaded file is empty.'] },
            message: 'Uploaded file is empty. Please provide a file with tweets.',
            success: false,
        };
    }

    // Split the file content by the dynamic hashtag
    const parts = fileContent.split(dynamicHashtag);
    const rawTweetsBodies: string[] = [];

    for (const part of parts) {
      const tweetBody = part.trim();
      // Add the part as a tweet body if it's not empty and not just the hashtag itself
      if (tweetBody && tweetBody !== dynamicHashtag) {
        rawTweetsBodies.push(tweetBody);
      }
    }

    // If splitting by hashtag yields nothing (e.g., hashtag not in file, or file is just the hashtag),
    // try splitting by newlines as a fallback, ensuring lines are not just the hashtag.
    if (rawTweetsBodies.length === 0 && fileContent.trim() !== dynamicHashtag) {
        const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== dynamicHashtag);
        if (lines.length > 0) {
            lines.forEach(line => {
                 // Ensure the line doesn't ALREADY end with the hashtag before appending.
                // This is a simplified check; more robust would be to ensure it's not `line + ' ' + hashtag`
                if (!line.endsWith(dynamicHashtag)) {
                    rawTweetsBodies.push(line);
                } else {
                    rawTweetsBodies.push(line.substring(0, line.lastIndexOf(dynamicHashtag)).trim());
                }
            });
        }
    }
    
    if (rawTweetsBodies.length === 0) {
       return {
         errors: { tweetFile: [`No valid tweet content found. Ensure content exists before each occurrence of "${dynamicHashtag}", or that the file is not empty or structured solely around the hashtag.`] },
         message: `Uploaded file contains no processable tweet content based on the format (content before "${dynamicHashtag}").`,
         success: false,
       };
    }

    rawTweetsBodies.forEach((body, index) => {
      extractedTweets.push({
        id: `${routeName}-tweet-${Date.now()}-${index}`,
        content: `${body.trim()} ${dynamicHashtag}`, // Ensure hashtag is appended
      });
    });
    
    if (extractedTweets.length === 0) {
      return {
        errors: {},
        message: 'No tweets could be generated. Please check your input file.',
        success: false,
      };
    }

    const newTrend: Trend = {
      id: `trend-${Date.now()}`,
      title,
      hashtag: dynamicHashtag,
      routeName,
      tweets: extractedTweets,
      createdAt: new Date(),
    };

    trends.unshift(newTrend);

    revalidatePath('/admin/dashboard');
    revalidatePath(`/trends/${routeName}`);
    revalidatePath('/trends');
    
    return { 
        message: `Trend "${title}" created successfully with ${extractedTweets.length} tweet(s) using hashtag ${dynamicHashtag}. View at /trends/${routeName}`, 
        success: true, 
        newTrendRoute: `/trends/${routeName}` 
    };

  } catch (error) {
    console.error('Error processing file or creating trend:', error);
    return { 
        message: 'An unexpected error occurred while creating the trend. Please ensure the file is plain text and not too large.', 
        success: false,
        errors: {},
    };
  }
}

export async function getTrendByRouteName(routeName: string): Promise<Trend | undefined> {
  // Ensure the lookup key is consistently processed: trimmed and lowercased
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
      return { message: 'Trend not found.', success: false, errors: {} };
    }

    trends.splice(trendIndex, 1);

    revalidatePath('/admin/dashboard');
    revalidatePath('/trends');

    return { message: 'Trend deleted successfully.', success: true, errors: null };
  } catch (error) {
    console.error('Error deleting trend:', error);
    return { message: 'An unexpected error occurred while deleting the trend.', success: false, errors: {} };
  }
}
