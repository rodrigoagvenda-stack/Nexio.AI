/**
 * Áudio que o SDR não conseguiu transcrever. Quando a transcrição falha, o motor entrega
 * ao funil só o rótulo "🎵 Áudio". Sem tratamento, o funil tomava isso por resposta vazia e
 * repetia a pergunta sem avisar que não entendeu o áudio.
 */

const AUDIO_PLACEHOLDER = '🎵 Áudio'

export const DEFAULT_AUDIO_FAIL_REPLY = 'Não consegui ouvir o seu áudio agora. Pode me mandar por escrito?'

/** Áudio transcrito, mas ininteligível (ruído, palavras soltas): pede texto ou novo áudio em vez de fingir que entendeu. */
export const DEFAULT_AUDIO_UNCLEAR_REPLY = 'Desculpa, não entendi o áudio. Poderia escrever ou reenviar?'

/** True se a mensagem do lead é SÓ áudio e nada foi transcrito (sobrou apenas o rótulo). */
export function isUnreadableAudio(leadText: string): boolean {
  if (!leadText.includes(AUDIO_PLACEHOLDER)) return false
  return leadText.split(AUDIO_PLACEHOLDER).join('').trim() === ''
}
