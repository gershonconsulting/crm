import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Plus } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import ActivityFeed from '@/components/activity/ActivityFeed';
import PipelineGrid from '@/components/streak/PipelineGrid';
import { Button } from '@/components/ui/button';
import DealForm from '@/components/deals/DealForm';
import ContactForm from '@/components/contacts/ContactForm';
import { UserRole } from '@/hooks/use-user-role';
import RoleBasedAccess from '@/components/auth/RoleBasedAccess';

const Pipeline: React.FC = () => {
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  // Fetch dashboard stats
  const { data: stats = { newContacts: 0 }, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <PipelineGrid />
      </div>

      {/* Deal Form Dialog */}
      <DealForm
        isOpen={isDealFormOpen}
        onOpenChange={setIsDealFormOpen}
      />

      {/* Contact Form Dialog */}
      <ContactForm
        isOpen={isContactFormOpen}
        onOpenChange={setIsContactFormOpen}
      />
    </MainLayout>
  );
};

export default Pipeline;