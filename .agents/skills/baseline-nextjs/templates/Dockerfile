# NEXT-REL-06: multi-stage, from the lockfile, distroless runtime with the standalone output only;
# both bases pinned by digest (the update automation bumps them, REL-IMG-03). Labels come from --label (REL-RUN-07).
FROM node:26-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json next.config.ts orval.config.ts ./
COPY openapi ./openapi
COPY messages ./messages
COPY src ./src
ENV NEXT_TELEMETRY_DISABLED=1
# commit SHA for deploymentId and the public config (NEXT-REL-15/17); not a secret
ARG GIT_COMMIT
RUN npm run build

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:1d736cf8b5716c07a245301f92717143215d248fd55771ee1936ef4b3302e531
WORKDIR /app
ARG GIT_COMMIT=unknown
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 GIT_COMMIT=${GIT_COMMIT}
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER 65532:65532
EXPOSE 3000
# the distroless entrypoint is node; node is PID 1 and receives SIGTERM (NEXT-REL-04)
CMD ["server.js"]
