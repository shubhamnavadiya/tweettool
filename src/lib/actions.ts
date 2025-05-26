
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
    .trim()
    .min(2, 'Hashtag must be at least 2 characters')
    .startsWith('#', 'Hashtag must start with #')
    .transform(val => val.trim()), // Ensure it's trimmed for storage/use
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
  tagHandles: z.string()
    .optional()
    .transform(val => val ? val.trim() : '') // Trim if present, else empty string
    .refine(val => {
      if (!val || val === '') return true; // Optional, so empty is fine
      const handles = val.split(',').map(h => h.trim());
      // Check if all non-empty handles start with @ and are longer than just "@"
      return handles.every(h => h === '' || (h.startsWith('@') && h.length > 1));
    }, {
      message: "Handles must be comma-separated, start with '@', and be more than one character (e.g., @user), or leave empty.",
    }),
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

  const { title, hashtag: dynamicHashtag, routeName, tweetFile, tagHandles: tagHandlesString } = validatedFields.data;
  // dynamicHashtag is already trimmed by Zod transform

  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
      success: false,
    };
  }

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
    
    for (let i = 0; i < parts.length; i++) {
      const tweetBodySegment = parts[i].trim();
      if (tweetBodySegment.length > 0) {
        rawTweetsBodies.push(tweetBodySegment);
      } else if (i === parts.length - 1 && tweetBodySegment.length === 0) {
        // If the last part is empty (e.g. file ends with hashtag), skip
        continue;
      } else if (i < parts.length -1) {
        // If an empty segment is not the last one, it implies consecutive hashtags or start with hashtag.
        // If the next part is non-empty, it should be processed.
        // This logic might need refinement if `dynamicHashtag` can be part of a valid tweet body before another `dynamicHashtag`.
        // For now, we assume `dynamicHashtag` primarily acts as a separator.
      }
    }

    // Fallback: if no tweets were extracted by splitting with hashtag,
    // but file is not empty, treat each line as a tweet.
    if (rawTweetsBodies.length === 0 && fileContent.trim() !== dynamicHashtag && fileContent.trim().length > 0) {
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
    
    const extractedTweets: Tweet[] = [];
    let parsedTagHandles: string[] = [];

    if (tagHandlesString && tagHandlesString.trim().length > 0) {
      parsedTagHandles = tagHandlesString
        .split(',')
        .map(h => h.trim())
        .filter(h => h.startsWith('@') && h.length > 1); // Ensures valid handles
      
      // If the user provided input for tagHandles but none were valid after parsing
      if (parsedTagHandles.length === 0 && tagHandlesString.trim() !== '') {
         return {
           errors: { tagHandles: ["No valid tag handles found from your input. Ensure they start with '@', are longer than one character, and are comma-separated."] },
           message: 'Tag handles were provided but none were valid.',
           success: false,
         };
      }
    }

    rawTweetsBodies.forEach((body, tweetIndex) => {
      const baseTweetContent = body.trim();

      if (parsedTagHandles.length > 0) {
        parsedTagHandles.forEach((handle, handleIndex) => {
          extractedTweets.push({
            id: `${routeName}-tweet-${Date.now()}-${tweetIndex}-${handleIndex}`, // Unique ID per generated tweet
            content: `${baseTweetContent} ${dynamicHashtag}\n${handle}`,
          });
        });
      } else {
        // No valid tag handles provided, or field was empty
        extractedTweets.push({
          id: `${routeName}-tweet-${Date.now()}-${tweetIndex}`,
          content: `${baseTweetContent} ${dynamicHashtag}`,
        });
      }
    });
    
    if (extractedTweets.length === 0) {
      // This case should ideally be caught earlier if rawTweetsBodies is empty,
      // or if tagHandles were provided but all invalid.
      return {
        errors: {}, // General error
        message: 'No tweets could be generated. Please check your input file and tag handles.',
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
        message: `Trend "${title}" created successfully with ${extractedTweets.length} tweet(s) using hashtag ${dynamicHashtag}${parsedTagHandles.length > 0 ? ` and ${parsedTagHandles.length} tag handle(s)` : ''}. View at /trends/${routeName}`, 
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
