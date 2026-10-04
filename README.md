# ENTER — Música online

Site de música em Node.js, preparado para **GitHub + Render**.

## Publicar no GitHub + Render

1. Crie um repositório no GitHub e envie **o conteúdo desta pasta** para a raiz do repositório.
2. No Render, escolha **New → Blueprint** e ligue o repositório.
3. O Render vai ler `render.yaml` e criar o Web Service.
4. O serviço usa `npm install` para instalar/verificar o projeto e `npm start` para o iniciar.
5. O endereço público será um domínio `onrender.com`.

### Armazenamento das músicas

O projeto guarda músicas, prévias, capas e dados em `/data`. O `render.yaml` configura um **Persistent Disk** nesse caminho para que esses ficheiros sobrevivam a reinícios e novos deploys.

> O Persistent Disk do Render exige um plano de Web Service que o suporte. Para um teste sem custo, pode remover temporariamente a secção `disk`, mas as músicas/dados serão perdidos quando o serviço reiniciar ou for redeployado.

### Administração

O único dado usado para entrar como administrador é o nome:

`psique`

Não existe palavra-passe de administrador.

### Código das músicas

O código de cada música é diferente: é usado para permitir ouvir a música completa e fazer download. Esse código continua separado do acesso do administrador.

## Desenvolvimento local

Requer Node.js 18+.

```bash
npm install
npm start
```

Depois abra `http://localhost:3000`.

## Render

O endpoint `/healthz` existe para o health check do Render.
