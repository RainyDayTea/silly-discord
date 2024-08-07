FROM ghcr.io/puppeteer/puppeteer:22.12.1

RUN npm i --include dev
RUN npm list
# RUN npx tsc