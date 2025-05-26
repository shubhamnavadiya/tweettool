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

    // Mock authentication: In a real app, verify credentials against a database
    // For this example, any username/password combination is accepted.
    // cookies().set('session', 'admin-logged-in', { httpOnly: true, path: '/' }); // Example cookie setting

  } catch (error) {
    return { message: 'Login failed. Please try again.' };
  }
  redirect('/admin/dashboard');
}


const TrendSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  hashtag: z.string().min(2, 'Hashtag must be at least 2 characters').startsWith('#', 'Hashtag must start with #'),
  routeName: z.string().min(3, 'Route name must be at least 3 characters').regex(/^[a-z0-9-]+$/, 'Route name can only contain lowercase letters, numbers, and hyphens'),
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
    };
  }

  const { title, hashtag, routeName, tweetFile } = validatedFields.data;

  // Check for routeName uniqueness
  if (trends.some(trend => trend.routeName === routeName)) {
    return {
      errors: { routeName: ['This route name is already taken.'] },
      message: 'Route name already exists.',
    };
  }

  try {
    const fileContent = await tweetFile.text();
    const extractedTweets: Tweet[] = fileContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((content, index) => ({
        id: `${routeName}-tweet-${index + 1}`,
        content: content,
      }));

    if (extractedTweets.length === 0) {
      return {
        errors: { tweetFile: ['No tweets found in the uploaded file or file is empty.'] },
        message: 'Uploaded file contains no valid tweets.',
      };
    }

    const newTrend: Trend = {
      id: `trend-${Date.now()}`,
      title,
      hashtag,
      routeName,
      tweets: extractedTweets,
      createdAt: new Date(),
    };

    trends.unshift(newTrend); // Add to the beginning of the array

    revalidatePath('/admin/dashboard');
    revalidatePath(`/trends/${routeName}`);
    
    return { message: `Trend "${title}" created successfully with ${extractedTweets.length} tweets. View at /trends/${routeName}`, success: true, newTrendRoute: `/trends/${routeName}` };

  } catch (error) {
    console.error('Error processing file or creating trend:', error);
    return { message: 'An unexpected error occurred while creating the trend.' };
  }
}

export async function getTrendByRouteName(routeName: string): Promise<Trend | undefined> {
  return trends.find(trend => trend.routeName === routeName);
}

export async function getAllTrends(): Promise<Trend[]> {
  // Sort by creation date, newest first
  return [...trends].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
