FROM node:22-bookworm-slim

WORKDIR /app

# Instala ferramentas básicas e pnpm
RUN npm install -g pnpm@9

# Copia manifests para cache otimizado das camadas Docker
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Instala dependências do projeto
RUN pnpm install

# Instala o Chromium e todas as bibliotecas de sistema necessárias para o Playwright
RUN npx playwright install --with-deps chromium

# Copia todo o código-fonte
COPY . .

# Compila o projeto (TypeScript + Vite build)
RUN pnpm build

# Porta padrão de execução
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Executa o Vite preview (com suporte a API e binding 0.0.0.0)
CMD ["pnpm", "start"]
