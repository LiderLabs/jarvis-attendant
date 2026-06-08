"use client"
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  _showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo = ({ className, _showText = true, size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'h-[80px]',
    md: 'h-[100px]',
    lg: 'h-[200px]',
  };
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/assets/Rapid.png"
        alt="Rapid Wash"
        className={cn(sizeClasses[size], 'w-auto')}
        height={size === 'sm' ? 40 : size === 'md' ? 56 : 80}
        width={size === 'sm' ? 150 : size === 'md' ? 250 : 280}
      />
    </div>
  );
};
