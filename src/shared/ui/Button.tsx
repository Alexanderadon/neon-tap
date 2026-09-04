import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sfxUi } from '@/shared/lib/audio';
import './ui.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', onClick, children, ...rest }: Props) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={(e) => {
        sfxUi();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
