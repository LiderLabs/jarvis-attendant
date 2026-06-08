'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { Fingerprint, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

interface WebAuthnVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staffId: string, staffName: string, timestamp: string) => void;
  orderId?: string;
  action?: string;
}

/**
 * WebAuthn Verification Modal
 * 
 * Modal popup for biometric verification before sensitive actions
 * - USSD payment authorization
 * - Cash handling confirmation
 * - No navigation away from current page
 */
const WebAuthnVerifyModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  orderId,
  action = 'Payment Authorization'
}: WebAuthnVerifyModalProps) => {
  const { isSupported, isProcessing, verifyStaff, enrolledStaff } = useWebAuthn();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedStaff, setVerifiedStaff] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setErrorMessage('');
      setVerifiedStaff(null);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (!isSupported) {
      setErrorMessage('Biometric authentication not supported on this device');
      setStatus('error');
      return;
    }

    if (enrolledStaff.length === 0) {
      setErrorMessage('No staff enrolled. Please enroll via Admin portal first.');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    
    const result = await verifyStaff();
    
    if (result.success && result.staffName && result.staffId) {
      setVerifiedStaff({ id: result.staffId, name: result.staffName });
      setStatus('success');
      
      const timestamp = new Date().toISOString();
      
      // Log the verification
      const verificationLog = JSON.parse(localStorage.getItem('rapidwash_verification_log') || '[]');
      verificationLog.push({
        staffId: result.staffId,
        staffName: result.staffName,
        orderId,
        action,
        timestamp,
        verified: true
      });
      localStorage.setItem('rapidwash_verification_log', JSON.stringify(verificationLog));
      
      // Auto-close and call success after brief delay
      setTimeout(() => {
        onSuccess(result.staffId!, result.staffName!, timestamp);
      }, 1000);
    } else {
      setErrorMessage('Verification failed. Please try again.');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={status !== 'scanning' ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4 border border-border">
        {/* Close Button */}
        {status !== 'scanning' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* Idle State */}
        {status === 'idle' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Fingerprint className="w-10 h-10 text-primary" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">
              {action}
            </h2>
            <p className="text-muted-foreground mb-6">
              Verify your identity to proceed with this action
            </p>

            {orderId && (
              <div className="bg-muted/50 rounded-xl p-3 mb-6">
                <p className="text-xs text-muted-foreground">ORDER ID</p>
                <p className="font-semibold text-foreground">{orderId}</p>
              </div>
            )}

            <Button
              onClick={handleVerify}
              className="w-full h-14 text-lg rounded-xl gap-2"
            >
              <Fingerprint className="w-5 h-5" />
              Verify with Biometrics
            </Button>
          </div>
        )}

        {/* Scanning State */}
        {status === 'scanning' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">
              Verifying...
            </h2>
            <p className="text-muted-foreground">
              Look at your device or place your finger on the sensor
            </p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && verifiedStaff && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">
              Verified!
            </h2>
            <p className="text-muted-foreground mb-4">
              Authorized by {verifiedStaff.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">
              Verification Failed
            </h2>
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStatus('idle')}
                className="flex-1 rounded-xl"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebAuthnVerifyModal;
