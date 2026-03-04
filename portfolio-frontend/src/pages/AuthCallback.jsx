import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCodeForTokens } from '../services/authService';
import useDelayedLoading from '../hooks/useDelayedLoading';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const hasProcessed = useRef(false);
  const showLoading = useDelayedLoading(isLoading);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasProcessed.current) {
      return;
    }
    hasProcessed.current = true;

    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          const errorDescription = searchParams.get('error_description');
          throw new Error(`Authentication failed: ${errorDescription || errorParam}`);
        }

        if (!code) {
          throw new Error('No authorization code received from authentication provider');
        }

        // Exchange code for tokens
        await exchangeCodeForTokens(code);

        // Redirect to portfolio management page
        const preAuthUrl = sessionStorage.getItem('preAuthUrl');
        sessionStorage.removeItem('preAuthUrl');
        
        if (preAuthUrl) {
          window.location.href = preAuthUrl;
        } else {
          // Default: redirect to portfolio management
          navigate('/portfolios', { replace: true });
        }
      } catch (err) {
        console.error('Authentication callback error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        {showLoading && <LoadingSpinner label="Completing sign-in..." />}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/', { replace: true })}>
          Return to Home
        </button>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
