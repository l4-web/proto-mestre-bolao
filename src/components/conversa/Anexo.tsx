import { Spinner } from "@l4-web/ui";
import { FileText, ImageOff, Lock } from "lucide-react";
import { useMidiaQuery } from "../../features/atendimento/atendimento.api";

/**
 * O anexo recebido, dentro da bolha.
 *
 * A API guardava o arquivo e sabia servir um link assinado desde sempre, e o front
 * nunca pediu: a bolha imprimia "anexo de image" em itálico e parava aí. O print que
 * o cliente manda para explicar o problema era exatamente o que quem atende não via.
 *
 * O link é buscado AQUI, por mensagem, e não junto da thread. Ele vale cinco minutos
 * porque é portador (quem tem a URL entra, sem token): se viesse com a conversa, um
 * caso aberto há dez minutos abriria com todas as imagens quebradas, e o atendente
 * culparia o anexo em vez do relógio.
 *
 * Os três estados de falha são DIFERENTES de propósito. "Não consigo ver" e "não
 * tenho permissão" e "o download falhou" levam a pessoa a fazer coisas distintas, e
 * um "erro ao carregar" genérico faria ela pedir o print de novo para um cliente que
 * já mandou.
 */
export function Anexo({ mensagemId, tipo }: { mensagemId: string; tipo: string }) {
  const { data, isLoading, error } = useMidiaQuery(mensagemId);

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 text-[12.5px] text-text-secondary">
        <Spinner /> carregando anexo
      </span>
    );
  }

  if (error) {
    // 403 é recorte de permissão (a capacidade de dados pessoais), não falha: o
    // anexo existe e esta pessoa não pode abrir. Dizer "não carregou" mandaria ela
    // recarregar a página para sempre.
    const status = (error as { status?: number }).status;
    const semPermissao = status === 403;
    return (
      <span className="flex items-center gap-2 text-[12.5px] text-text-secondary">
        {semPermissao ? <Lock size={14} /> : <ImageOff size={14} />}
        {semPermissao
          ? "anexo disponível, mas fora do seu perfil"
          : `não consegui carregar o anexo de ${tipo}`}
      </span>
    );
  }

  if (!data?.url) return null;

  const ehImagem = (data.mime ?? "").startsWith("image/");
  if (ehImagem) {
    return (
      <a href={data.url} target="_blank" rel="noreferrer" className="block">
        {/*
          `max-h` e não altura fixa: print de celular é retrato alto e print de tela é
          paisagem largo. Altura fixa esmagaria um dos dois, e é justamente no print
          esmagado que a pessoa não lê a mensagem de erro que o cliente quis mostrar.
        */}
        <img
          src={data.url}
          alt={data.nome ?? "anexo enviado pelo cliente"}
          loading="lazy"
          className="max-h-72 w-auto max-w-full rounded-[10px] border border-[var(--l4-surface-borda)] object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-[12.5px] underline underline-offset-2"
    >
      <FileText size={14} />
      {data.nome ?? `abrir anexo de ${tipo}`}
    </a>
  );
}
