FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine
# The nginx entrypoint runs envsubst on templates, so API_ORIGIN can be set
# per environment without rebuilding the image.
ENV API_ORIGIN=http://api:8080
# DNS used to re-resolve the upstream per request. Default: Docker's embedded
# resolver; Fly overrides with its internal resolver ([fdaa::3]) in fly.toml.
ENV NGINX_RESOLVER=127.0.0.11
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
