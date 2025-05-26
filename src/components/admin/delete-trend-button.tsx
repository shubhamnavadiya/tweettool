
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteTrendAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteTrendButtonProps {
  trendId: string;
  trendTitle: string;
}

function SubmitDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      aria-disabled={pending}
      className="w-full sm:w-auto"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {pending ? 'Deleting...' : 'Yes, delete trend'}
    </Button>
  );
}

export default function DeleteTrendButton({ trendId, trendTitle }: DeleteTrendButtonProps) {
  const initialState = { message: null, errors: null, success: false };
  // Explicitly type the state and dispatch for useActionState
  const [state, dispatch]: [typeof initialState, (payload: FormData) => void] = useActionState(deleteTrendAction, initialState);
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);


  useEffect(() => {
    if (state?.message) {
      toast({
        variant: state.success ? 'default' : 'destructive',
        title: state.success ? 'Success' : 'Error',
        description: state.message,
      });
      if (state.success) {
        setIsDialogOpen(false); // Close dialog on successful deletion
      }
    }
  }, [state, toast]);

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full md:w-auto">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form
          action={(formData) => {
            dispatch(formData);
          }}
        >
          <input type="hidden" name="trendId" value={trendId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trend titled "<strong>{trendTitle}</strong>"
              and all its associated tweets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state?.message && !state.success && (
            <div className="my-3 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{state.message}</span>
              {/* @ts-ignore */}
              {state?.errors?.trendId && <p>{state.errors.trendId.join(', ')}</p>}
            </div>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setIsDialogOpen(false)}>Cancel</AlertDialogCancel>
            <SubmitDeleteButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

