import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

export function formatPostTime(dateObj: Date): string {
  if (!dateObj) return '';
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours > 24) {
    return format(dateObj, "MMM d, yyyy");
  } else {
    return formatDistanceToNowStrict(dateObj, { addSuffix: true });
  }
}
