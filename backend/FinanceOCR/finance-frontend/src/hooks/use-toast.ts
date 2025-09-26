import { useState } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

const toasts: Toast[] = [];
let toastCounter = 0;

export function useToast() {
  const [, forceUpdate] = useState({});

  const toast = ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = (++toastCounter).toString();
    const newToast: Toast = {
      id,
      title,
      description,
      variant,
    };

    toasts.push(newToast);
    forceUpdate({});

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      const index = toasts.findIndex(t => t.id === id);
      if (index > -1) {
        toasts.splice(index, 1);
        forceUpdate({});
      }
    }, 5000);

    return id;
  };

  const dismiss = (toastId: string) => {
    const index = toasts.findIndex(t => t.id === toastId);
    if (index > -1) {
      toasts.splice(index, 1);
      forceUpdate({});
    }
  };

  return {
    toast,
    dismiss,
    toasts,
  };
}