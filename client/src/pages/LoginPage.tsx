import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { loginSchema } from '../schemas/authSchemas';
import type { LoginFormData } from '../schemas/authSchemas';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken);
      // Route user to admin dashboard if admin, otherwise traveler dashboard
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError('root', { message: err.response?.data?.message || 'Login failed' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0e15] relative overflow-hidden px-4">
      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md p-8 rounded-2xl bg-[#151622]/60 backdrop-blur-xl border border-white/5 shadow-[0_8px_32px_0_rgba(99,102,241,0.05)] transition hover:border-indigo-500/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-3xl mb-4">
            ✈️
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-50 to-purple-200 bg-clip-text text-transparent">
            Swarm Travel AI
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Access your supervisor agent scheduling swarm
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-4 py-3 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="name@example.com"
            />
            {errors.email && <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.password.message}</p>}
          </div>

          {errors.root && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              ⚠️ {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200"
          >
            {isSubmitting ? 'Verifying credentials...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
