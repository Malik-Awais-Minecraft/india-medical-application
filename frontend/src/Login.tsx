import { useState } from 'react';

const API_BASE_URL = 'http://localhost:8000';

interface LoginProps {
  onLogin: (token: string, name: string, id: number) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, full_name: fullName, password }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to send OTP');
        }
        setMode('verify');
        setError(null);
        return; // Don't try to log in yet
      }

      if (mode === 'verify') {
        const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Invalid OTP');
        }

        // OTP verified and account created. Now automatically log them in:
        setMode('login'); 
        alert('Account verified successfully! Please sign in.');
        return;
      }

      // Mode === 'login'
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Login failed');
      }
      const data = await res.json();

      // Fetch user info
      const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const me = await meRes.json();

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_name', me.full_name);
      onLogin(data.access_token, me.full_name, me.id);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4">
      <div className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Residency Companion</h1>
          <p className="mt-2 text-gray-500 text-sm">AI-Powered Medical Decision Support</p>
        </div>

        {mode !== 'verify' && (
          <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-7">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Register
            </button>
          </div>
        )}

        {mode === 'verify' && (
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-gray-800">Verify your Email</h2>
            <p className="text-sm text-gray-500 mt-1">We sent a 6-digit OTP to <strong>{email}</strong>.</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'verify' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">6-Digit OTP</label>
              <input
                type="text" value={otp} onChange={e => setOtp(e.target.value)} required
                placeholder="123456" maxLength={6}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center tracking-[0.5em] text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ) : (
            <>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text" value={fullName} onChange={e => setFullName(e.target.value)} required={mode === 'register'}
                    placeholder="Dr. Priya Sharma"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="doctor@hospital.in"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Please wait...</>
            ) : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Send OTP' : 'Verify Account'}
          </button>
          
          {mode === 'verify' && (
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className="w-full text-indigo-600 text-sm font-medium hover:underline mt-2"
            >
              Back to Registration
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
