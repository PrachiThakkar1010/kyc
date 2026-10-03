import { defineMiddleware } from 'astro:middleware';
import { sessionClient } from './lib/supabase';
import type { Profile } from './lib/types';

// Guards the writer panel. Everything under /admin needs an active writer,
// except the login page. New writers must change their password first.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/admin')) return next();

  const supabase = sessionClient(context.request, context.cookies);
  context.locals.supabase = supabase;

  const isLogin = pathname === '/admin/login';
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return isLogin ? noStore(await next()) : context.redirect('/admin/login');
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return context.redirect('/admin/login?error=inactive');
  }

  context.locals.user = user;
  context.locals.profile = profile as Profile;

  if (isLogin) return context.redirect('/admin');
  if (profile.must_change_password && pathname !== '/admin/password' && pathname !== '/admin/logout') {
    return context.redirect('/admin/password');
  }
  if (pathname.startsWith('/admin/writers') && profile.role !== 'admin') {
    return context.redirect('/admin');
  }

  return noStore(await next());
});

function noStore(response: Response) {
  try {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex');
  } catch {
    /* some responses have read-only headers */
  }
  return response;
}
