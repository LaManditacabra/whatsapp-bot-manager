import { useState } from 'react'
import { api, setToken } from '../api'

export default function Auth({ onLogin, showLoading, hideLoading }) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    setError('')
    if (!email || !password) return
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
    showLoading(isLogin ? 'Ingresando...' : 'Creando cuenta...')
    try {
      const body = isLogin ? { email, password } : { email, password, name }
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) })
      setToken(data.token)
      onLogin(data)
    } catch {
      setError(isLogin ? 'Email o contraseña incorrectos' : 'Error al registrarse')
    }
    hideLoading()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="BotAr" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-blue-900 tracking-tight">BotAr</h1>
          <p className="text-blue-600/60 mt-1 text-sm font-medium">Gestión de bots WhatsApp</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Nombre" />
            )}
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              className={`w-full rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all border ${submitted && !email ? 'border-red-300' : 'border-gray-200'}`}
              placeholder="Email" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password"
              className={`w-full rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all border ${submitted && !password ? 'border-red-300' : 'border-gray-200'}`}
              placeholder="Contraseña" />
            <button type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-sm hover:shadow-md">
              {isLogin ? 'Ingresar' : 'Crear cuenta'}
            </button>
            <p className="text-center text-sm text-gray-500">
              {isLogin ? (
                <>¿No tenés cuenta? <a href="#" onClick={e => { e.preventDefault(); setIsLogin(false); setError('') }} className="text-blue-600 hover:text-blue-700 font-medium">Registrate</a></>
              ) : (
                <>¿Ya tenés cuenta? <a href="#" onClick={e => { e.preventDefault(); setIsLogin(true); setError('') }} className="text-blue-600 hover:text-blue-700 font-medium">Ingresá</a></>
              )}
            </p>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
