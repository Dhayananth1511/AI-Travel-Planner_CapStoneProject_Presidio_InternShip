import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { registerSchema } from '../schemas/authSchemas';
import type { RegisterFormData } from '../schemas/authSchemas';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      // Create user account
      const res = await api.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      // Automatically log the profile in
      setAuth(res.data.user, res.data.accessToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError('root', { message: err.response?.data?.message || 'Registration failed' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0e15] relative overflow-hidden px-4 py-8">
      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md p-8 rounded-2xl bg-[#151622]/60 backdrop-blur-xl border border-white/5 shadow-[0_8px_32px_0_rgba(99,102,241,0.05)] transition hover:border-indigo-500/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-3xl mb-4">
            🗺️
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-purple-200 via-indigo-50 to-indigo-200 bg-clip-text text-transparent">
            Join Swarm AI
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Build curated, budget-feasible travel itineraries
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name
            </label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="Elon Musk"
            />
            {errors.name && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="elon@spacex.com"
            />
            {errors.email && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Confirm Password
            </label>
            <input
              {...register('confirmPassword')}
              type="password"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f101a] border border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/40 focus:outline-none transition-all duration-200"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-rose-400 text-xs mt-1 font-medium">{errors.confirmPassword.message}</p>
            )}
          </div>

          {errors.root && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              ⚠️ {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-purple-600/10 hover:shadow-purple-600/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200"
          >
            {isSubmitting ? 'Registering profile...' : 'Build Account'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
