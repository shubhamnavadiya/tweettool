
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
    .trim(),
  routeName: z.string()
    .min(3, 'Route name must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Route name can only contain lowercase letters, numbers, and hyphens.')
    .transform(val => val.trim().toLowerCase()),
  tweetFile: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'Tweet file is required.')
    .refine((file) => file.type === 'text/plain', 'File must be a .txt file.')
    .refine((file) => file.size < 5 * 1024 * 1024, 'File size must be less than 5MB.'),
  tagHandles: z.string().optional()
    .refine(val => {
      if (!val || val.trim() === '') return true; // Optional, so empty or whitespace is fine
      const handles = val.split(',').map(h => h.trim());
      // Every handle must start with @ and be longer than just "@"
      return handles.every(h => h.startsWith('@') && h.length > 1);
    }, {
      message: 'If provided, all tag handles must start with @ and be at least 2 characters long (e.g., @user1, @user2). Separate multiple handles with commas. Leave empty if not needed.'
    }),
});


export async function createTrendAction(prevState: any, formData: FormData) {
  const validatedFields = TrendSchema.safeParse({
    title: formData.get('title'),
    hashtag: formData.get('hashtag')?.toString().trim(), // Ensure hashtag is trimmed
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

  const { title, hashtag: dynamicHashtagInput, routeName, tweetFile, tagHandles } = validatedFields.data;
  
  // Ensure dynamicHashtag is just the hashtag string for processing
  const dynamicHashtag = dynamicHashtagInput.trim();


  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
      success: false,
    };
  }

  let appendedHandlesString = '';
  if (tagHandles && tagHandles.trim() !== '') {
    const parsedHandles = tagHandles
      .split(',')
      .map(h => h.trim())
      .filter(h => h.startsWith('@') && h.length > 1);
    if (parsedHandles.length > 0) {
      appendedHandlesString = parsedHandles.join(' ');
    }
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
    
    // Split the file content by the dynamic hashtag to get segments
    // These segments are the content *before* each occurrence of the hashtag
    const segments = fileContent.split(dynamicHashtag);
    let tweetBodies: string[] = [];

    if (segments.length <= 1 && fileContent.trim() !== dynamicHashtag && !fileContent.includes(dynamicHashtag)) {
      // If hashtag is not in the file at all, OR if the file is just content without the hashtag,
      // treat lines as tweets. This is a fallback.
      tweetBodies = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && line !== dynamicHashtag);
    } else {
       // Process segments that were before the hashtag
      for (let i = 0; i < segments.length; i++) {
        const segmentContent = segments[i].trim();
        if (segmentContent.length > 0) {
          // This segment was content before a hashtag.
          // If it's not the last segment OR if the file ends with the hashtag, it's a valid body.
          if (i < segments.length -1 || fileContent.endsWith(dynamicHashtag)) {
             tweetBodies.push(segmentContent);
          }
        }
      }
       // Special case: if the file has content but the hashtag is not present, and the above loop didn't catch it.
      if (tweetBodies.length === 0 && !fileContent.includes(dynamicHashtag) && fileContent.trim().length > 0) {
        tweetBodies = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && line !== dynamicHashtag);
      }
    }


    if (tweetBodies.length === 0) {
       return {
         errors: { tweetFile: [`No valid tweet content found. Ensure content exists before each occurrence of "${dynamicHashtag}", or that the file is not empty and is structured correctly with the hashtag.`] },
         message: `Uploaded file contains no processable tweet content based on the dynamic hashtag "${dynamicHashtag}".`,
         success: false,
       };
    }
    
    tweetBodies.forEach((body, index) => {
      let tweetContent = `${body.trim()} ${dynamicHashtag}`;
      if (appendedHandlesString) {
        tweetContent += `\n${appendedHandlesString}`;
      }
      extractedTweets.push({
        id: `${routeName}-tweet-${Date.now()}-${index}`,
        content: tweetContent,
      });
    });
    
    if (extractedTweets.length === 0) { // Should be redundant due to earlier check, but good for safety
      return {
        errors: {},
        message: `No tweets could be generated with hashtag ${dynamicHashtag}. Please check your input file.`,
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
