import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useAuth()

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [session, navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return toast.error('Preencha os campos')
    
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Credenciais inválidas')
    } else {
      toast.success('Login efetuado com sucesso!')
      navigate('/', { replace: true })
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-box card">
        <div className="login-header">
          <div className="logo-icon mx-auto" aria-hidden="true">
            <img src="/brand/mark.svg" alt="" />
          </div>
          <h2>ELETROCED</h2>
          <p>Acesse o sistema gerenciador de ordens</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>E-mail</label>
            <input 
              className="form-control" 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" 
              required
            />
          </div>
          <div className="form-group mt-16">
            <label>Senha</label>
            <input 
              className="form-control" 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" 
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary login-btn" 
            disabled={loading}
          >
            {loading ? 'Acessando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
