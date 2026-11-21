# NEST-REL-08: multi-stage, from the lockfile, distroless runtime, every base pinned by digest (update automation bumps them)
FROM node:26-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
# The commit is built in, the release version is injected at deploy time (NEST-REL-06): --build-arg GIT_COMMIT=<sha>
ARG GIT_COMMIT=unknown
RUN printf '{"commit":"%s"}\n' "$GIT_COMMIT" > dist/build-info.json

FROM node:26-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:1d736cf8b5716c07a245301f92717143215d248fd55771ee1936ef4b3302e531
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
USER 65532:65532
# The distroless entrypoint is node, so node is PID 1 and receives SIGTERM.
CMD ["--import", "./dist/instrumentation.js", "dist/main.js"]
