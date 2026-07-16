import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROD_URL = 'https://socialdashboard.rbvcompany.com'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) throw new Error('Não autenticado')

    const { data: profile } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') throw new Error('Apenas administradores podem realizar esta ação')

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()
    const { email, name, role, password, deleteUserId } = body

    // --- Excluir usuário ---
    if (deleteUserId) {
      if (deleteUserId === user.id) throw new Error('Não é possível excluir sua própria conta')
      await adminClient.from('profiles').delete().eq('id', deleteUserId)
      const { error: delErr } = await adminClient.auth.admin.deleteUser(deleteUserId)
      if (delErr) throw delErr
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // --- Convidar / criar usuário ---
    if (!email) throw new Error('Email obrigatório')

    const validRole = role === 'admin' ? 'admin' : 'viewer'

    if (password && password.length >= 6) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || '', role: validRole },
      })
      if (createErr) throw createErr

      await adminClient.from('profiles').upsert({
        id: created.user.id,
        email,
        name: name || '',
        role: validRole,
      })
    } else {
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: PROD_URL,
        data: { name: name || '', role: validRole },
      })

      if (inviteErr) {
        if (inviteErr.message.toLowerCase().includes('already been registered') ||
            inviteErr.message.toLowerCase().includes('already registered')) {
          const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(email, {
            redirectTo: PROD_URL,
          })
          if (resetErr) throw resetErr
        } else {
          throw inviteErr
        }
      } else {
        await adminClient.from('profiles').upsert({
          id: invited.user.id,
          email,
          name: name || '',
          role: validRole,
        }, { onConflict: 'id', ignoreDuplicates: true })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
