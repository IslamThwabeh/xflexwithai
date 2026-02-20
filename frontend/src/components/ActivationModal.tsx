// client/src/components/ActivationModal.tsx
import { useState } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

interface ActivationModalProps {
  type: 'course' | 'flexai';
  onClose: () => void;
  onSuccess: () => void;
}

export function ActivationModal({ type, onClose, onSuccess }: ActivationModalProps) {
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [step, setStep] = useState<'key' | 'email'>('key');

  const keyInfo = trpc.registrationKeys.getKeyInfo.useQuery(
    { keyCode: key.trim() },
    { enabled: false, retry: false }
  );

  const activateCourseKey = trpc.registrationKeys.activateKey.useMutation();
  const redeemLexaiByEmail = trpc.lexai.redeemKeyByEmail.useMutation();
  
  const handleValidateKey = async () => {
    if (!key.trim()) {
      setError('Please enter an activation key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await keyInfo.refetch();
      const info = result.data;
      if (!info || !('exists' in info) || !info.exists) {
        throw new Error('Invalid activation key');
      }

      if (!info.isActive) {
        throw new Error('This key is deactivated');
      }

      if (type === 'flexai' && info.keyType !== 'lexai') {
        throw new Error('This key is for courses. Please activate it from the course activation.');
      }

      if (type === 'course' && info.keyType !== 'course') {
        throw new Error('This key is for LexAI. Please activate it from the LexAI activation.');
      }

      setStep('email');
    } catch (err: any) {
      setError(err.message || 'Failed to verify key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (type === 'flexai') {
        await redeemLexaiByEmail.mutateAsync({ keyCode: key.trim(), email: email.trim() });
      } else {
        await activateCourseKey.mutateAsync({ keyCode: key.trim(), email: email.trim() });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to activate. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const title = type === 'flexai' ? 'Activate FlexAI' : 'Activate Course Access';
  const description = type === 'flexai'
    ? 'Enter your FlexAI registration key to activate 30 days of AI-powered chart analysis.'
    : 'Enter your course registration key to access all trading courses.';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-green-600">
              Activation Successful!
            </p>
            <p className="text-gray-600 mt-2">
              Redirecting...
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">{description}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Activation Key
                </label>
                <Input
                  type="text"
                  placeholder="Enter your key (e.g., ABC123)"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && step === 'key' && handleValidateKey()}
                  disabled={loading}
                  className="uppercase"
                />
              </div>

              {step === 'email' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter your email (e.g., name@example.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleRedeem()}
                    disabled={loading}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    We’ll assign this key to your email for future access.
                  </p>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={step === 'key' ? handleValidateKey : handleRedeem}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {step === 'key' ? 'Checking...' : 'Activating...'}
                    </>
                  ) : (
                    step === 'key' ? 'Continue' : 'Activate'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
