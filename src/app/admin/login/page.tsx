'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect } from 'react';
import { loginAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
      <LogIn className="mr-2 h-4 w-4" />
      {pending ? 'Logging In...' : 'Login'}
    </Button>
  );
}

export default function AdminLoginPage() {
  const initialState = { message: null, errors: {} };
  const [state, dispatch] = useActionState(loginAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message && !state.errors) { // Assuming successful login won't have errors field set by action
        // Redirection is handled by the server action, client-side toast for other messages
    } else if (state?.message && state.errors) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: state.message,
      });
    }
  }, [state, toast]);

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-primary">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Access the dashboard to manage trends and tweets.
          </CardDescription>
        </CardHeader>
        <form action={dispatch}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                name="username" 
                type="text" 
                placeholder="admin" 
                required 
                aria-describedby="username-error"
              />
              {state?.errors?.username && (
                <p id="username-error" className="text-sm text-destructive">
                  {state.errors.username.join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="••••••••" 
                required 
                aria-describedby="password-error"
              />
               {state?.errors?.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {state.errors.password.join(', ')}
                </p>
              )}
            </div>
             {state?.message && state.errors && Object.keys(state.errors).length === 0 && (
              <p className="text-sm text-destructive text-center">{state.message}</p>
            )}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
