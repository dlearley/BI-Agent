'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/types';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    facilityId: '',
    role: UserRole.VIEWER,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      router.push('/');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to BI-Agent</CardTitle>
          <CardDescription>
            Let&apos;s set up your account (Step {step} of 3)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="facilityId">Facility ID (Optional)</Label>
                <Input
                  id="facilityId"
                  value={formData.facilityId}
                  onChange={(e) =>
                    setFormData({ ...formData, facilityId: e.target.value })
                  }
                  placeholder="Enter your facility ID"
                />
                <p className="text-sm text-muted-foreground">
                  If you&apos;re a recruiter, enter your facility ID
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-medium">Review Your Information</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Name:</span> {formData.firstName}{' '}
                    {formData.lastName}
                  </p>
                  {formData.facilityId && (
                    <p>
                      <span className="font-medium">Facility ID:</span>{' '}
                      {formData.facilityId}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              <Button type="submit" className="ml-auto">
                {step < 3 ? 'Next' : 'Complete'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
