interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, body: string, ctaLabel: string, link: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f5f7;font-family:Inter,Arial,sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:32px;max-width:480px">
<tr><td><div style="font-size:22px;font-weight:700;letter-spacing:.02em;color:#5C2946">neoTRAINING</div>
<h1 style="font-size:20px;margin:24px 0 8px">${escapeHtml(title)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 24px">${body}</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#5C2946;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${escapeHtml(ctaLabel)}</a>
<p style="font-size:13px;color:#6e6e73;margin:24px 0 0">Si el botón no funciona, copia este enlace en tu navegador:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#6e6e73;margin:16px 0 0">El enlace es válido por 24 horas.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function invitationEmail(firstName: string, link: string): EmailContent {
  const name = escapeHtml(firstName);
  return {
    subject: 'Te invitaron a Neo',
    html: layout('¡Bienvenida a Neo!', `Hola ${name}, tu Coach creó tu cuenta. Crea tu contraseña para empezar a entrenar.`, 'Crear mi contraseña', link),
    text: `Hola ${firstName}, tu Coach creó tu cuenta en Neo. Crea tu contraseña aquí (válido 24 horas): ${link}`,
  };
}

export function resetPasswordEmail(firstName: string, link: string): EmailContent {
  const name = escapeHtml(firstName);
  return {
    subject: 'Recupera tu contraseña de Neo',
    html: layout('Recupera tu contraseña', `Hola ${name}, recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, ignora este mensaje.`, 'Restablecer contraseña', link),
    text: `Hola ${firstName}, restablece tu contraseña aquí (válido 24 horas): ${link}\nSi no fuiste tú, ignora este mensaje.`,
  };
}
