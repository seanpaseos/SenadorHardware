import React, { useState, useEffect } from 'react';
import { UserRole } from '../App';
import { Lock, ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signIn, logout, AuthUser } from '../services/authService';

interface PasswordEntryProps {
  role: UserRole;
  onLoginSuccess: (user: AuthUser) => void;
  onBack: () => void;
}

const PasswordEntry: React.FC<PasswordEntryProps> = ({ role, onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setEmail(`${role}@gmail.com`); // auto-fill email based on role
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const user = await signIn(email, password);

      if (user.role !== role) {
        await logout();
        setError('Invalid credentials for this role');
        return;
      }

      onLoginSuccess(user);
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'owner': return 'from-red-600 to-red-800';
      case 'cashier': return 'from-blue-500 to-indigo-600';
      case 'checker': return 'from-green-500 to-emerald-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRoleTitle = () => {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-8">
      <img src="/photos/Hardware.jpg" alt="Hardware Store" className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />
      <div className="max-w-md w-full relative z-20">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors duration-200"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Role Selection
        </button>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className={`h-24 bg-gradient-to-r ${getRoleColor()} flex items-center justify-center`}>
            <Lock className="w-8 h-8 text-white mr-3" />
            <h2 className="text-2xl font-bold text-white">Welcome {getRoleTitle()}</h2>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Hidden Email Field */}
              <input type="hidden" value={email} readOnly />

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 pr-12"
                    placeholder="Enter password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-6 bg-gradient-to-r ${getRoleColor()} text-white font-semibold rounded-lg hover:opacity-90 transition-opacity duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordEntry;
