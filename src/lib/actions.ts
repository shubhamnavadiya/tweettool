
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies as nextCookies } from 'next/headers';
import type { Trend, Tweet } from './types';
import { revalidatePath } from 'next/cache';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  doc, 
  setDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';

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

  if (username === 'bjp4botad' && password === 'BJP4Botad') {
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
      errors: {},
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
    .transform(val => val?.trim() ?? '') // Ensure it's trimmed or empty string
    .refine(val => {
      if (val === '') return true; // Optional, so empty is fine
      const handles = val.split(',').map(h => h.trim());
      return handles.every(h => h.startsWith('@') && h.length > 1 && !h.includes(' '));
    }, {
      message: 'If provided, handles must be comma-separated, start with @, be at least 2 characters long, and contain no spaces (e.g., @user1,@another_handle).'
    }),
});

export async function createTrendAction(prevState: any, formData: FormData) {
  const validatedFields = TrendSchema.safeParse({
    title: formData.get('title'),
    hashtag: formData.get('hashtag')?.toString().trim(),
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
  const dynamicHashtag = dynamicHashtagInput.trim();

  // Check for routeName uniqueness in Firestore
  const trendsCollection = collection(db, 'trends');
  const q = query(trendsCollection, where('routeName', '==', routeName));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
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
      .filter(h => h.startsWith('@') && h.length > 1); // Filter again just in case Zod refine didn't catch edge cases
    if (parsedHandles.length > 0) {
      appendedHandlesString = parsedHandles.join(' '); // Join with space for appending
    }
  }

  try {
    const fileContent = await tweetFile.text();
    if (fileContent.trim().length === 0) {
      return {
        errors: { tweetFile: ['Uploaded file is empty.'] },
        message: 'Uploaded file is empty. Please provide a file with tweets.',
        success: false,
      };
    }

    const rawTweetBodies = fileContent.split(dynamicHashtag)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);

    if (rawTweetBodies.length === 0) {
      // Fallback if split doesn't work as expected (e.g. hashtag not in file)
      // Treat each line as a tweet body if it's not just the hashtag.
      const linesAsBodies = fileContent.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && line !== dynamicHashtag);
      
      if (linesAsBodies.length > 0) {
        rawTweetBodies.push(...linesAsBodies);
      } else {
         return {
          errors: { tweetFile: [`No valid tweet content found. Ensure content exists before each occurrence of "${dynamicHashtag}", or that the file is not empty and is structured correctly with the hashtag. The hashtag itself should not be the only content on lines intended as tweets.`] },
          message: `Uploaded file contains no processable tweet content based on the dynamic hashtag "${dynamicHashtag}".`,
          success: false,
        };
      }
    }
    
    const extractedTweets: Tweet[] = [];
    rawTweetBodies.forEach((body, index) => {
      let tweetContent = `${body.trim()} ${dynamicHashtag}`;
      if (appendedHandlesString) {
        tweetContent += `\n${appendedHandlesString}`;
      }
      extractedTweets.push({
        id: `${routeName}-tweet-${Date.now()}-${index}`, // This ID is for client-side key, Firestore will have its own doc ID for the trend
        content: tweetContent,
      });
    });

    if (extractedTweets.length === 0) {
      return {
        errors: {},
        message: `No tweets could be generated with hashtag ${dynamicHashtag}. Please check your input file.`,
        success: false,
      };
    }

    const trendId = `trend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newTrend: Omit<Trend, 'createdAt'> & { createdAt: Timestamp } = {
      id: trendId, // Use this as Firestore document ID
      title,
      hashtag: dynamicHashtag,
      routeName,
      tweets: extractedTweets,
      createdAt: Timestamp.fromDate(new Date()), // Store as Firestore Timestamp
    };

    await setDoc(doc(db, "trends", trendId), newTrend);

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
    let errorMessage = 'An unexpected error occurred while creating the trend.';
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
    }
    return { 
      message: errorMessage,
      success: false,
      errors: {},
    };
  }
}

export async function getTrendByRouteName(routeName: string): Promise<Trend | undefined> {
  const processedRouteName = routeName.trim().toLowerCase();
  const trendsCollection = collection(db, 'trends');
  const q = query(trendsCollection, where('routeName', '==', processedRouteName));
  
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return undefined;
    }
    // Assuming routeName is unique, so take the first doc
    const trendDoc = querySnapshot.docs[0];
    const data = trendDoc.data();
    return {
      id: trendDoc.id, // Use Firestore document ID
      title: data.title,
      hashtag: data.hashtag,
      routeName: data.routeName,
      tweets: data.tweets,
      createdAt: (data.createdAt as Timestamp).toDate(), // Convert Timestamp to Date
    } as Trend;
  } catch (error) {
    console.error("Error fetching trend by route name:", error);
    return undefined;
  }
}

export async function getAllTrends(): Promise<Trend[]> {
  const trendsCollection = collection(db, 'trends');
  const q = query(trendsCollection, orderBy('createdAt', 'desc'));
  
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Use Firestore document ID
        title: data.title,
        hashtag: data.hashtag,
        routeName: data.routeName,
        tweets: data.tweets,
        createdAt: (data.createdAt as Timestamp).toDate(), // Convert Timestamp to Date
      } as Trend;
    });
  } catch (error) {
    console.error("Error fetching all trends:", error);
    return []; // Return empty array on error
  }
}

const DeleteTrendSchema = z.object({
  trendId: z.string().min(1, 'Trend ID is required'), // This will be Firestore document ID
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
    // Check if trend exists before attempting delete (optional, deleteDoc won't error if doc doesn't exist)
    const trendDocRef = doc(db, "trends", trendId);
    // const trendSnap = await getDoc(trendDocRef);
    // if (!trendSnap.exists()) {
    //   return { message: 'Trend not found in database.', success: false, errors: {} };
    // }

    await deleteDoc(trendDocRef);

    revalidatePath('/admin/dashboard');
    revalidatePath('/trends'); // Revalidate all trends page
    // Potentially revalidate specific trend pages if they were cached, though dynamic routes might handle this.

    return { message: 'Trend deleted successfully.', success: true, errors: null };
  } catch (error) {
    console.error('Error deleting trend:', error);
    let errorMessage = 'An unexpected error occurred while deleting the trend.';
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
    }
    return { message: errorMessage, success: false, errors: {} };
  }
}
