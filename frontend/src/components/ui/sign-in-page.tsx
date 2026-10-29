'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, error: authError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  const [localError, setLocalError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const displayError = localError || authError

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setIsLoading(true)
    try {
      const user = await login(formData.email, formData.password)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen w-full flex font-sans text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 overflow-hidden relative bg-slate-950">
      {/* Full Screen Vivid Video Background */}
      <div className="absolute inset-0 z-0 bg-slate-950">
        <video
          src="/project-1.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover transition-transform duration-[20s] hover:scale-105 ease-out opacity-90"
        />
        {/* Subtle Edge Vignette Overlay for Crisp Video & Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/50 pointer-events-none"></div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full p-4 sm:p-6">
        
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Ultra-Clean Frosted Glass Card */}
        <div className="w-full max-w-[440px] p-8 sm:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700 bg-white/85 backdrop-blur-xl rounded-[2.25rem] border border-white/50 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.35)] relative z-20">
          
          <div className="mb-8 text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-950 text-white shadow-xl shadow-slate-900/30 mb-2 border border-white/20">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>
            <h1 className="display-font text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
              AT Induser Security Control Portal
            </p>
          </div>
          
          {displayError && (
             <div className="p-4 mb-6 text-xs font-semibold text-red-700 bg-red-50/90 rounded-2xl border border-red-200 flex items-start shadow-sm backdrop-blur-md">
               {displayError}
             </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-600 ml-1">
                Identity Sequence
              </label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleInputChange as any}
                placeholder="Enter email or admin ID"
                className="form-input text-sm py-3.5 bg-white/90 border-slate-300 focus:bg-white shadow-sm"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-600 ml-1">
                Access Code
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange as any}
                  placeholder="••••••••"
                  className="form-input text-sm py-3.5 pr-12 bg-white/90 border-slate-300 focus:bg-white shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer group">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange as any}
                  className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500/20 cursor-pointer transition-colors"
                />
                <span className="group-hover:text-slate-950 transition-colors">Remember device</span>
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Recover access?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 mt-4 shadow-lg"
            >
              {isLoading ? 'Authenticating...' : 'Secure Login'}
            </button>

          </form>
          
          <div className="mt-8 text-center pt-5 border-t border-slate-200/80">
             <button onClick={(e) => { e.preventDefault(); setFormData({...formData, email: 'admin', password: 'admin'}) }} className="text-[10px] font-extrabold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]">
               Demo Admin Override
             </button>
          </div>

        </div>
      </div>
    </div>
  )
}

