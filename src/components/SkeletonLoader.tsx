import React from 'react';

export function CardSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 py-4 px-3 sm:px-4 md:px-5 lg:px-6 border-b border-buildops-border w-full animate-pulse bg-buildops-bg/10">
      {/* Avatar Skeleton */}
      <div className="w-10 h-10 rounded-full bg-buildops-border/70 shrink-0 hidden sm:block" />

      <div className="flex-1 min-w-0 space-y-3 pt-0.5">
        {/* Header Skeleton */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-buildops-border/70 shrink-0 sm:hidden" />
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <div className="h-3.5 bg-buildops-border/60 rounded w-28" />
            <div className="h-2.5 bg-buildops-border/40 rounded w-16" />
          </div>
        </div>

        {/* Title and Body Skeleton */}
        <div className="space-y-2 mb-2">
          <div className="h-4.5 bg-buildops-border/60 rounded w-3/4" />
          <div className="space-y-1.5 mt-2">
             <div className="h-3 bg-buildops-border/40 rounded w-full" />
             <div className="h-3 bg-buildops-border/40 rounded w-5/6" />
          </div>
        </div>

        {/* Tags / Meta Skeleton */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="h-5 bg-buildops-card border border-buildops-border/40 rounded w-16" />
          <div className="h-5 bg-buildops-card border border-buildops-border/40 rounded w-20" />
          <div className="h-3 bg-buildops-border/30 rounded w-24 sm:ml-auto" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex items-center justify-between max-w-md mt-2 pt-1 border-t border-buildops-border/20">
          <div className="h-4 bg-buildops-border/40 rounded w-8" />
          <div className="h-4 bg-buildops-border/40 rounded w-8" />
          <div className="h-4 bg-buildops-border/40 rounded w-8" />
          <div className="h-4 bg-buildops-border/40 rounded w-8" />
          <div className="h-4 bg-buildops-border/40 rounded w-4" />
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="w-full max-w-5xl mx-auto pb-20 md:pb-8 relative animate-pulse">
      {/* Sticky Header Skeleton */}
      <div className="sticky top-0 z-40 bg-buildops-bg/90 backdrop-blur-xl h-[56px] border-b border-buildops-border flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-buildops-border/60 shrink-0" />
          <div className="h-4 w-16 bg-buildops-border/65 rounded" />
        </div>
        <div className="w-5 h-5 rounded bg-buildops-border/60" />
      </div>

      <div className="space-y-3 px-4 sm:px-6 pt-3 pb-0">
        {/* Profile Header Block */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-5 items-start">
          <div className="w-[88px] h-[88px] sm:w-[124px] sm:h-[124px] rounded-full border border-buildops-border bg-buildops-border/40 shrink-0" />
          <div className="flex-1 min-w-0 w-full pt-1 space-y-2.5">
             <div className="h-8 bg-buildops-border/60 rounded w-48 sm:w-64" />
             <div className="h-4 bg-buildops-border/40 rounded w-32" />
             <div className="h-4 bg-buildops-border/40 rounded w-full max-w-md pt-0.5" />
          </div>
        </div>

        {/* Info row */}
        <div className="space-y-1.5 pt-2 pb-1">
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="h-4 bg-buildops-border/30 rounded w-24" />
            <div className="h-4 bg-buildops-border/30 rounded w-36" />
            <div className="h-4 bg-buildops-border/30 rounded w-20" />
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="h-4 bg-buildops-border/40 rounded w-28" />
            <div className="h-4 bg-buildops-border/40 rounded w-28" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex flex-col px-4 sm:px-6 pt-4">
        <div className="flex border-b border-buildops-border mb-2 gap-6">
          <div className="h-10 w-16 border-b-2 border-buildops-blue/40" />
          <div className="h-10 w-16" />
        </div>
        
        {/* Subheader */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-buildops-border/50 rounded w-24" />
        </div>

        {/* Content list */}
        <div className="space-y-1 divide-y divide-buildops-border">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="flex w-full items-center gap-4 py-3 pb-3.5 px-4 sm:px-3 border-b border-buildops-border animate-pulse">
      <div className="w-10 h-10 rounded-full bg-buildops-border/70 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 bg-buildops-border/50 rounded w-2/3" />
        <div className="h-2.5 bg-buildops-border/35 rounded w-1/5" />
      </div>
      <div className="w-10 h-10 rounded-lg bg-buildops-card border border-buildops-border/40 shrink-0" />
    </div>
  );
}

export function SavedCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-buildops-border bg-buildops-card/40 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-buildops-border/60 shrink-0" />
        <div className="h-3.5 w-24 bg-buildops-border/45 rounded" />
      </div>
      <div className="space-y-2 mb-2 pl-11">
        <div className="h-4.5 bg-buildops-border/60 rounded w-2/3" />
        <div className="space-y-1.5 mt-2">
           <div className="h-3 bg-buildops-border/40 rounded w-full" />
           <div className="h-3 bg-buildops-border/40 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-16 lg:pb-0 relative animate-pulse">
      <div className="flex-1 w-full max-w-4xl min-w-0 animate-pulse">
        {/* Sticky top header skeleton */}
        <div className="sticky top-0 z-40 bg-buildops-bg/95 backdrop-blur-md h-14 mb-6 px-3 sm:px-4 md:px-5 lg:px-6 border-b border-buildops-border flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-buildops-border/60 shrink-0" />
          <div className="h-4 w-12 bg-buildops-border/65 rounded" />
        </div>
        
        <div className="px-3 sm:px-4 md:px-5 lg:px-6 space-y-6">
          {/* Header Skeleton */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-buildops-border/65 shrink-0" />
                <div className="space-y-2">
                   <div className="h-4 bg-buildops-border/60 rounded w-32" />
                   <div className="h-3 bg-buildops-border/40 rounded w-20" />
                </div>
              </div>
              <div className="h-8 bg-buildops-border/50 rounded-full w-20" />
            </div>
          </div>

          {/* Tags Skeleton */}
          <div className="flex gap-2">
             <div className="h-5.5 bg-buildops-card border border-buildops-border/40 rounded w-16" />
             <div className="h-5.5 bg-buildops-card border border-buildops-border/40 rounded w-12" />
          </div>

          {/* Title & Body Skeleton */}
          <div className="space-y-4">
             <div className="h-7 bg-buildops-border/65 rounded w-3/4 mb-4" />
             <div className="space-y-2.5 mb-6">
                <div className="h-3.5 bg-buildops-border/45 rounded w-full" />
                <div className="h-3.5 bg-buildops-border/45 rounded w-full" />
                <div className="h-3.5 bg-buildops-border/45 rounded w-5/6" />
                <div className="h-3.5 bg-buildops-border/45 rounded w-4/5" />
             </div>
          </div>

          {/* Action Bar Skeleton */}
          <div className="flex items-center gap-6 py-4 border-y border-buildops-border">
             <div className="h-5 bg-buildops-border/40 rounded w-12" />
             <div className="h-5 bg-buildops-border/40 rounded w-12" />
             <div className="h-5 bg-buildops-border/40 rounded w-12" />
          </div>

          {/* Comment Input Skeleton */}
          <div className="flex gap-4 pt-2">
            <div className="w-10 h-10 rounded-full bg-buildops-border/65 shrink-0" />
            <div className="h-10 bg-buildops-card rounded-lg border border-buildops-border flex-1 animate-pulse" />
          </div>

          {/* Comments List Skeleton */}
          <div className="space-y-6 pt-4">
             {/* Comment 1 */}
             <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-buildops-border/65 shrink-0" />
               <div className="flex-1 space-y-3">
                 <div className="h-4 bg-buildops-border/60 rounded w-24" />
                 <div className="h-3.5 bg-buildops-border/40 rounded w-full" />
                 <div className="h-3.5 bg-buildops-border/40 rounded w-5/6" />
               </div>
             </div>
             
             {/* Comment 2 */}
             <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-buildops-border/65 shrink-0" />
               <div className="flex-1 space-y-3">
                 <div className="h-4 bg-buildops-border/60 rounded w-20" />
                 <div className="h-3.5 bg-buildops-border/40 rounded w-3/4" />
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Sidebar Skeleton */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-6 pt-2 lg:pt-20">
         <div className="h-12 bg-buildops-card border border-buildops-border rounded-lg w-full" />
         <div className="h-48 bg-buildops-card border border-buildops-border rounded-xl w-full" />
      </aside>
    </div>
  );
}
