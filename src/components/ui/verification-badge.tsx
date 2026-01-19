import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VerificationBadgeProps {
  isVerified: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showNotVerified?: boolean;
}

export function VerificationBadge({ 
  isVerified, 
  className, 
  size = 'sm',
  showNotVerified = false 
}: VerificationBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  if (isVerified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle 
              className={cn(
                sizeClasses[size],
                'text-primary fill-primary/20 inline-block ml-1 shrink-0',
                className
              )} 
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Verified Email</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (showNotVerified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle 
              className={cn(
                sizeClasses[size],
                'text-amber-500 inline-block ml-1 shrink-0',
                className
              )} 
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Email Not Verified</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

// Helper function to check if user has verified email
export function isEmailVerified(emailConfirmedAt?: string | null): boolean {
  return !!emailConfirmedAt;
}
