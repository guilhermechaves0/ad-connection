# Use a imagem do Node.js como base (ajuste a versão conforme necessário)
FROM node:18

# Defina o diretório de trabalho no container
WORKDIR /usr/src/app

# Copie o package.json e package-lock.json para instalar as dependências
COPY package*.json ./

# Instale as dependências
RUN npm install

# Copie o restante do código da API para o diretório de trabalho do container
COPY . .

# Defina a variável de ambiente para produção (ou desenvolvimento)
ENV NODE_ENV=production

# Exponha a porta em que sua API está escutando (definida no .env)
EXPOSE 9876

# Defina o comando para iniciar a API (ajuste conforme necessário)
CMD ["npm", "run", "start"]
