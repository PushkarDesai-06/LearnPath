"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Confirms before a lesson's mastery and attempts are cleared. Controlled by `lesson`. */
export function ResetLessonDialog({
  lesson,
  onConfirm,
  onCancel,
}: {
  lesson: { id: string; title: string } | null;
  onConfirm: (lesson: { id: string; title: string }) => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog
      open={lesson !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset progress?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears your mastery and practice attempts for{" "}
            {lesson ? lesson.title : "this lesson"}. Other lessons are not
            affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (lesson) onConfirm(lesson);
            }}
          >
            Reset progress
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
