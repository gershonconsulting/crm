import React from 'react';
import { DealWithContact } from '@shared/schema';
import BoxDialog from '@/components/streak/BoxDialog';

interface DealDetailDialogProps {
  deal: DealWithContact;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

/** Kept for older views — the box view is now the Streak-style BoxDialog. */
const DealDetailDialog: React.FC<DealDetailDialogProps> = ({ deal, isOpen, onOpenChange }) => (
  <BoxDialog dealId={deal?.id ?? null} open={isOpen} onOpenChange={onOpenChange} />
);

export default DealDetailDialog;
