import { useUIStore } from '../store/uiStore';

export const useToast = () => {
  const { toast } = useUIStore();
  return toast;
};
