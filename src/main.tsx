import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from '../mab-chao-fabrica'
import { supabase } from './supabase'
import './index.css'

function Sistema() {
  const [session, setSession] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [aprovado, setAprovado] = useState(false)

  const [modoCadastro, setModoCadastro] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function verificarAprovacao(userId: string) {
    const { data } = await supabase
      .from('usuarios')
      .select('aprovado')
      .eq('id', userId)
      .maybeSingle()

    setAprovado(data?.aprovado === true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const sessao = data.session
      setSession(sessao)

      if (sessao?.user) {
        await verificarAprovacao(sessao.user.id)
      }

      setCarregando(false)
    })

    const { data } = supabase.auth.onAuthStateChange(
      async (_event, sessao) => {
        setSession(sessao)

        if (sessao?.user) {
          await verificarAprovacao(sessao.user.id)
        } else {
          setAprovado(false)
        }
      }
    )

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  async function entrar() {
    if (!email || !senha) {
      setMensagem('Digite seu e-mail e sua senha.')
      return
    }

    setMensagem('Entrando...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setMensagem('E-mail ou senha incorretos.')
      return
    }

    if (data.user) {
      await verificarAprovacao(data.user.id)
    }

    setMensagem('')
  }

  async function cadastrar() {
    if (!nome || !email || !senha) {
      setMensagem('Preencha nome, e-mail e senha.')
      return
    }

    if (senha.length < 6) {
      setMensagem('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setMensagem('Enviando solicitação...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome,
        },
      },
    })

    if (error) {
      setMensagem('Não foi possível criar o cadastro.')
      return
    }

    if (data.user) {
      const { error: erroUsuario } = await supabase
        .from('usuarios')
        .insert({
          id: data.user.id,
          nome: nome,
          email: email,
          aprovado: false,
        })

      if (erroUsuario) {
        setMensagem('Erro ao enviar solicitação de acesso.')
        return
      }
    }

    setMensagem(
      'Solicitação enviada! Agora é só aguardar a aprovação do seu acesso.'
    )

    setNome('')
    setSenha('')
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Carregando...
      </div>
    )
  }

  if (session && !aprovado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">⏳</div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Aguardando aprovação
          </h1>

          <p className="text-gray-600 mb-6">
            Sua solicitação foi recebida. Assim que seu acesso for aprovado,
            você poderá entrar no sistema da MAB.
          </p>

          <button
            onClick={sair}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-900">
            MAB Embreagem
          </h1>

          <p className="text-gray-500 mt-2 mb-6">
            Sistema de Produção
          </p>

          {modoCadastro && (
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
            />
          )}

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !modoCadastro) {
                entrar()
              }
            }}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4"
          />

          {modoCadastro ? (
            <button
              onClick={cadastrar}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
            >
              Solicitar acesso
            </button>
          ) : (
            <button
              onClick={entrar}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
            >
              Entrar
            </button>
          )}

          {mensagem && (
            <p className="text-sm text-center mt-4 text-gray-600">
              {mensagem}
            </p>
          )}

          <div className="border-t mt-6 pt-5 text-center">
            <button
              onClick={() => {
                setModoCadastro(!modoCadastro)
                setMensagem('')
              }}
              className="text-sm font-semibold text-gray-700"
            >
              {modoCadastro
                ? 'Já tenho acesso'
                : 'Ainda não tenho acesso — Criar cadastro'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sistema />
  </React.StrictMode>
)
