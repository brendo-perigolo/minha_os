import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Busca sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de logion/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserProfile(userId) {
    // Usamos RLS para ler a tabela usuarios que deve estar permitida
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setUserProfile(data)
    } else {
      console.error('Perfil não encontrado do usuario logado', error)
      setUserProfile(null)
    }
    setLoading(false)
  }

  // Helper flags
  const isAdmin = userProfile?.is_administrador === true

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}
