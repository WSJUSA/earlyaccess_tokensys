import React, { useState, useCallback } from 'react';
import { TokenValidationResult, EarlyAccessToken } from '../types';

interface TokenInputProps {
  onTokenValidated?: (token: EarlyAccessToken) => void;
  onTokenInvalid?: (error: string) => void;
  validateEndpoint?: string;
  placeholder?: string;
  buttonText?: string;
  loadingText?: string;
  className?: string;
  groupClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  errorClassName?: string;
  successClassName?: string;
}

export const TokenInput: React.FC<TokenInputProps> = ({
  onTokenValidated,
  onTokenInvalid,
  validateEndpoint = '/api/early-access/validate',
  placeholder = 'Enter your early access token (e.g., BETA2025 or EA-A1B2C3D4-0001)',
  buttonText = 'Validate Token',
  loadingText = 'Validating...',
  className = '',
  groupClassName = '',
  inputClassName = '',
  buttonClassName = '',
  errorClassName = '',
  successClassName = ''
}) => {
  const [tokenCode, setTokenCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TokenValidationResult | null>(null);

  const handleValidate = useCallback(async () => {
    if (!tokenCode.trim()) {
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch(validateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenCode: tokenCode.trim() }),
      });

      const result: TokenValidationResult = await response.json();
      setValidationResult(result);

      if (result.valid && result.token && onTokenValidated) {
        onTokenValidated(result.token);
      } else if (!result.valid && onTokenInvalid) {
        onTokenInvalid(result.error || 'Invalid token');
      }
    } catch (error) {
      const errorMessage = 'Failed to validate token. Please try again.';
      setValidationResult({ valid: false, error: errorMessage });
      if (onTokenInvalid) {
        onTokenInvalid(errorMessage);
      }
    } finally {
      setIsValidating(false);
    }
  }, [tokenCode, validateEndpoint, onTokenValidated, onTokenInvalid]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleValidate();
    }
  };

  const formatTokenCode = (value: string) => {
    // Clean input but don't force formatting - let validation handle format checking
    return value.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTokenCode(e.target.value);
    setTokenCode(formatted);
    // Clear previous validation result when user starts typing
    if (validationResult) {
      setValidationResult(null);
    }
  };

  return (
    <div className={`token-input-container ${className}`}>
      <div className={`token-input-group ${groupClassName}`}>
        <input
          type="text"
          value={tokenCode}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isValidating}
          className={`token-input ${inputClassName} ${
            validationResult?.valid ? 'token-input-success' : ''
          } ${
            validationResult && !validationResult.valid ? 'token-input-error' : ''
          }`}
          maxLength={18} // EA-XXXXXXXX-XXXX = 18 chars
        />
        <button
          type="button"
          onClick={handleValidate}
          disabled={isValidating || !tokenCode.trim()}
          className={`token-validate-button ${buttonClassName}`}
        >
          {isValidating ? loadingText : buttonText}
        </button>
      </div>

      {validationResult && (
        <div className={`token-validation-message ${
          validationResult.valid
            ? `token-success-message ${successClassName}`
            : `token-error-message ${errorClassName}`
        }`}>
          {validationResult.valid ? (
            <span>✓ Token validated successfully!</span>
          ) : (
            <span>✗ {validationResult.error}</span>
          )}
        </div>
      )}

    </div>
  );
};
