// Robô diário: lê cada casa no Firestore, monta os alertas do dia e manda a notificação para os aparelhos.
// Roda no GitHub Actions (.github/workflows/notificar.yml) com a chave da conta de serviço no segredo FIREBASE_SA.
// Teste local sem enviar: SECA=1 FIREBASE_SA="$(cat chave.json)" node scripts/notificar.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as M from '../js/modelo.js';

const SITE = 'https://msdohko.github.io/encontas/';
const seco = process.env.SECA === '1';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore(), fcm = getMessaging();
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()); // AAAA-MM-DD
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
const forcar = process.env.FORCAR === '1'; // botão "Run workflow": manda agora para todos, ignorando o horário
const COLECOES = ['formas', 'fontes', 'entradas', 'recorrentes', 'compras', 'lancamentos', 'dispositivos'];

let enviados = 0, removidos = 0;
for (const casaDoc of (await db.collection('casas').get()).docs) {
  const dados = { casa: { id: casaDoc.id, ...casaDoc.data() } };
  await Promise.all(COLECOES.map(async c => { dados[c] = (await casaDoc.ref.collection(c).get()).docs.map(d => ({ ...d.data(), id: d.id })); }));
  const aparelhos = dados.dispositivos.filter(x => x.ativo !== false && x.token);
  if (!aparelhos.length) continue;
  for (const ap of aparelhos) {
    // roda de hora em hora: cada aparelho recebe uma vez por dia, a partir do horário que escolheu
    if (!forcar && (hora < (ap.horaAviso ?? 10) || ap.ultimoEnvio === hoje)) continue;
    const n = M.textoNotificacao(M.alertas(dados, hoje, { diasAntes: ap.diasAntes ?? 1 }));
    console.log(`${casaDoc.id} / ${ap.pessoa} (${ap.aparelho}): ${n ? n.titulo + ' | ' + n.corpo : 'nada hoje'}`);
    if (seco) continue;
    if (!n) { await casaDoc.ref.collection('dispositivos').doc(ap.id).update({ ultimoEnvio: hoje }); continue; }
    try {
      await fcm.send({ token: ap.token,
        webpush: {
          notification: { title: n.titulo, body: n.corpo, icon: SITE + 'icone-192.png', badge: SITE + 'icone-192.png', tag: 'encontas-diario', renotify: true },
          fcmOptions: { link: SITE + n.link },
          headers: { Urgency: 'normal', TTL: String(12 * 3600) },
        },
        data: { link: n.link } });
      enviados++;
      await casaDoc.ref.collection('dispositivos').doc(ap.id).update({ ultimoEnvio: hoje });
    } catch (e) {
      console.error('  falhou:', e.code || e.message);
      if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'].includes(e.code)) {
        await casaDoc.ref.collection('dispositivos').doc(ap.id).update({ ativo: false, desativadoPor: 'token inválido', desativadoEm: new Date().toISOString() });
        removidos++;
      }
    }
  }
}
console.log(`Pronto (${hoje} ${hora}h): ${enviados} enviados, ${removidos} aparelhos desativados.`);
