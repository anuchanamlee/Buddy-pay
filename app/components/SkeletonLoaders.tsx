'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Base Skeleton Component
interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'rounded' | 'circular';
}

export function Skeleton({ className = '', variant = 'default' }: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    rounded: 'rounded-lg', 
    circular: 'rounded-full'
  };

  return (
    <div 
      className={cn(
        'animate-pulse bg-gray-200',
        variantClasses[variant],
        className
      )}
    />
  );
}

// Text Skeleton
interface TextSkeletonProps {
  lines?: number;
  className?: string;
}

export function TextSkeleton({ lines = 1, className = '' }: TextSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

// Card Skeleton
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-6 animate-pulse', className)}>
      <div className="flex items-center space-x-4 mb-4">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <TextSkeleton lines={3} />
    </div>
  );
}

// Table Skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className = '' }: TableSkeletonProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-gray-100 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Bill Summary Skeleton
export const BillSummarySkeleton = () => {
  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header skeleton */}
      <div className="bg-jade-600 p-6 rounded-t-xl">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-7 w-1/3 bg-white/30" />
          <Skeleton variant="rounded" className="h-6 w-1/4 bg-white/30" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/20 p-4 rounded-lg">
              <Skeleton className="h-5 w-1/2 mx-auto mb-2 bg-white/40" />
              <Skeleton className="h-7 w-1/3 mx-auto bg-white/40" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="bg-white rounded-b-xl border border-gray-200 p-6 space-y-6">
        {/* Food items skeleton */}
        <div>
          <Skeleton className="h-6 w-1/3 mb-4" />
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 p-4 bg-gray-100">
              <div className="grid grid-cols-12 gap-4">
                <Skeleton className="col-span-7 h-5" />
                <Skeleton className="col-span-2 h-5" />
                <Skeleton className="col-span-3 h-5" />
              </div>
            </div>
            
            {/* Items */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4">
                  <Skeleton className="col-span-7 h-5" />
                  <Skeleton className="col-span-2 h-5" />
                  <Skeleton className="col-span-3 h-5" />
                </div>
              </div>
            ))}
            
            {/* Total skeleton */}
            <div className="p-4 bg-blue-50">
              <div className="grid grid-cols-12 gap-4">
                <Skeleton className="col-span-7 h-6 bg-blue-200" />
                <Skeleton className="col-span-5 h-6 bg-blue-200" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Participants skeleton */}
        <div>
          <Skeleton className="h-6 w-1/3 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center">
                  <Skeleton variant="circular" className="w-8 h-8 mr-3" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
                <div className="p-4 text-center space-y-3">
                  <Skeleton className="h-4 w-1/2 mx-auto" />
                  <Skeleton className="h-8 w-1/3 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Food Items List Skeleton
export const FoodItemsListSkeleton = () => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/4" />
      
      <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-100">
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-5 h-5" />
            <Skeleton className="col-span-3 h-5" />
            <Skeleton className="col-span-4 h-5" />
          </div>
        </div>
        
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-4">
              <Skeleton className="col-span-5 h-6" />
              <Skeleton className="col-span-3 h-6" />
              <Skeleton className="col-span-4 h-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Statistics Page Skeleton
export function StatisticsPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-1/3 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Skeleton variant="circular" className="h-12 w-12" />
              <Skeleton className="h-8 w-1/3" />
            </div>
            <Skeleton className="h-4 w-2/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <CardSkeleton className="h-80" />

      {/* Table */}
      <TableSkeleton rows={5} columns={3} />
    </div>
  );
}

// Bill History Skeleton
export function BillHistoryPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Bill Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Card Header */}
            <div className="p-4 border-b">
              <div className="flex justify-between items-start mb-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton variant="circular" className="h-6 w-6" />
              </div>
              <Skeleton className="h-4 w-1/3" />
            </div>
            
            {/* Card Content */}
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <Skeleton variant="circular" className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            
            {/* Card Footer */}
            <div className="border-t p-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Button Skeleton
export const ButtonSkeleton = ({ className = '' }: { className?: string }) => (
  <Skeleton className={cn('h-10 w-full', className)} />
); 