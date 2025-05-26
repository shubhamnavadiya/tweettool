
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
  hashtag: z.string().trim().min(2, 'Hashtag must be at least 2 characters').startsWith('#', 'Hashtag must start with #'),
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
  tagHandles: z.string().optional(), // Comma-separated list of handles, e.g., @handle1, @handle2
});


export async function createTrendAction(prevState: any, formData: FormData) {
  const validatedFields = TrendSchema.safeParse({
    title: formData.get('title'),
    hashtag: formData.get('hashtag'),
    routeName: formData.get('routeName'),
    tweetFile: formData.get('tweetFile'),
    tagHandles: formData.get('tagHandles'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create trend. Please check the form.',
      success: false,
    };
  }

  const { title, hashtag: dynamicHashtagInput, routeName, tweetFile, tagHandles: tagHandlesInput } = validatedFields.data;
  const dynamicHashtag = dynamicHashtagInput.trim(); // Ensure hashtag from form is trimmed

  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
      success: false,
    };
  }

  let parsedTagHandles: string[] = [];
  if (tagHandlesInput && tagHandlesInput.trim().length > 0) {
    parsedTagHandles = tagHandlesInput
      .split(',')
      .map(h => h.trim())
      .filter(h => h.startsWith('@') && h.length > 1); // Basic validation for handles
  }
  const tagHandlesString = parsedTagHandles.length > 0 ? `\n${parsedTagHandles.join(' ')}` : '';


  try {
    const fileContent = await tweetFile.text();
    const rawTweetsBodies: string[] = [];

    if (fileContent.trim().length === 0) {
        return {
            errors: { tweetFile: ['Uploaded file is empty.'] },
            message: 'Uploaded file is empty. Please provide a file with tweets.',
            success: false,
        };
    }
    
    // Split the file content by the dynamic hashtag
    const parts = fileContent.split(dynamicHashtag);

    // Iterate through parts that were *before* a hashtag
    for (let i = 0; i < parts.length; i++) {
      const tweetBody = parts[i].trim();
      
      // If it's the last part and it's empty, it means the file ended with the hashtag or was empty after the last hashtag
      if (i === parts.length - 1 && tweetBody.length === 0) {
        continue; 
      }

      // If the part is not empty, consider it a tweet body
      if (tweetBody.length > 0) {
        rawTweetsBodies.push(tweetBody);
      } else if (i < parts.length - 1 && parts[i+1].trim().length > 0) {
        // Handle case where hashtag is at the beginning of a line or file,
        // and there's content *after* it that should be a new tweet.
        // This logic might need refinement based on exact desired behavior for content *after* a hashtag if not split by another.
        // For now, if a part is empty but it's not the very last part of the split,
        // it implies the hashtag was found, and the next part might be a new tweet.
        // This is slightly complex if a hashtag itself is meant to be a tweet.
        // The current logic: capture text *before* the hashtag.
      }
    }
    
    // If no content was found *before* any hashtag, but the file is not empty,
    // and the file doesn't *just* consist of the hashtag itself or whitespace.
    // This could mean the hashtag was not in the file, or the file structure is different.
    if (rawTweetsBodies.length === 0 && fileContent.trim() !== dynamicHashtag && fileContent.trim().length > 0) {
        // Fallback: treat each non-empty line as a tweet and append the dynamic hashtag
        // This fallback activates if the primary split-by-hashtag yields no pre-hashtag content.
        const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && line !== dynamicHashtag);
        if (lines.length > 0) {
            lines.forEach(line => {
                rawTweetsBodies.push(line);
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
    
    const extractedTweets: Tweet[] = rawTweetsBodies
      .map((body, index) => ({
        id: `${routeName}-tweet-${Date.now()}-${index + 1}`,
        content: `${body.trim()} ${dynamicHashtag}${tagHandlesString}`,
      }));


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
        message: `Trend "${title}" created successfully with ${extractedTweets.length} tweets using hashtag ${dynamicHashtag}. View at /trends/${routeName}`, 
        success: true, 
        newTrendRoute: `/trends/${routeName}` 
    };

  } catch (error) {
    console.error('Error processing file or creating trend:', error);
    return { 
        message: 'An unexpected error occurred while creating the trend. Please ensure the file is plain text and not too large.', 
        success: false,
        errors: {}, // Ensure errors object exists
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

